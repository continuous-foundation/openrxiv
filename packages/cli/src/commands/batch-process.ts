import { Command, Option } from 'commander';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pLimit from 'p-limit';
import { listMonthFiles, type S3FileInfo } from '../aws/month-lister.js';
import { downloadFile } from '../aws/downloader.js';
import { processMecaFile } from '../utils/meca-processor.js';
import {
  getFolderStructure,
  removeDuplicateFolders,
  sortFoldersChronologically,
  type FolderStructure,
} from 'openrxiv-utils';
import {
  generateMonthRange,
  parseMonthInput,
  validateMonthFormat,
  getDefaultServer,
} from '../utils/index.js';
import { parseBatchInput, validateBatchFormat } from '../utils/batches.js';
import { getBucketName } from '../aws/bucket-explorer.js';

interface BatchOptions {
  month?: string;
  batch?: string;
  server?: 'biorxiv' | 'medrxiv';
  limit?: number;
  apiUrl: string;
  apiKey?: string;
  output: string;
  dryRun: boolean;
  force: boolean;
  keep: boolean;
  fullExtract: boolean;
  concurrency: number;
  maxFileSize: string;
  checkIndividualLimit: number;
}

export const batchProcessCommand = new Command('batch-process')
  .description('Batch process MECA files for a given month or batch.')
  .option(
    '-m, --month <month>',
    'Month(s) to process. Supports: YYYY-MM, comma-separated list (2025-01,2025-02), or wildcard pattern (2025-*). If not specified, processes backwards from current month to 2018-12',
  )
  .option(
    '-b, --batch <batch>',
    'Batch to process. Supports: single batch (e.g., "1"), range (e.g., "1-10"), or comma-separated list (e.g., "1,2,3"). Use this for historical content before 2018-12.',
  )
  .option('-s, --server <server>', 'Server type: biorxiv or medrxiv', getDefaultServer())
  .option(
    '-l, --limit <number>',
    'Maximum number of files to process. If not specified, processes all available files',
  )
  .option('-a, --api-url <url>', 'API base URL', 'https://biorxiv.curvenote.dev')
  .addOption(
    new Option(
      '-k, --api-key <key>',
      'API key for authentication (or use BIORXIV_API_KEY env var)',
    ).env('BIORXIV_API_KEY'),
  )
  .option('-o, --output <dir>', 'Output directory for extracted files', './batch-extracted')
  .option('--dry-run', 'List files without processing them', false)
  .option('--force', 'Force reprocessing of existing files', false)
  .option('--keep', 'Keep MECA files after processing (default: false)', false)
  .option(
    '--full-extract',
    'Extract entire MECA file instead of selective extraction (default: false)',
    false,
  )
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (default: 1)', '1')
  .option('--max-file-size <size>', 'Skip files larger than this size (e.g., 100MB, 2GB)', '')
  .option('--aws-bucket <bucket>', 'AWS S3 bucket name (auto-set based on server if not specified)')
  .option('--aws-region <region>', 'AWS region', 'us-east-1')
  .option(
    '--check-individual-limit <number>',
    'Threshold for individual checking (default: 100)',
    '100',
  )
  .action(async (options: BatchOptions) => {
    if (!options.apiKey) {
      console.error(
        '❌ API key is required. Please provide a valid API key using --api-key or set the BIORXIV_API_KEY environment variable.',
      );
      process.exit(1);
    }
    const response = await axios.get(`${options.apiUrl}/health`).catch((error) => {
      console.error('❌ API is not healthy. Please check the API URL and API key.');
      process.exit(1);
    });
    if (response.status !== 200) {
      console.error('❌ API is not healthy. Please check the API URL and API key.');
      process.exit(1);
    }
    try {
      if (options.batch && options.month) {
        console.log(
          `🚀 Starting batch processing for batch: ${options.batch} and month: ${options.month}`,
        );
      } else if (options.batch) {
        console.log(`🚀 Starting batch processing for batch: ${options.batch}`);
      } else if (options.month) {
        console.log(`🚀 Starting batch processing for month: ${options.month}`);
      } else {
        console.log(`🚀 Starting backwards batch processing`);
      }

      console.log(
        `📊 Processing limit: ${options.limit ? `${options.limit} files` : 'all available files'}`,
      );
      console.log(`🔍 Dry run mode: ${options.dryRun ? 'enabled' : 'disabled'}`);
      console.log(`⚡ Concurrency: ${options.concurrency} files`);
      console.log(`🌐 Server: ${options.server}`);

      if (!options.server) {
        // Default to biorxiv if no server is specified
        options.server = getDefaultServer();
      }
      if (!['biorxiv', 'medrxiv'].includes(options.server)) {
        console.error('❌ Invalid server. Please use "biorxiv" or "medrxiv".');
        process.exit(1);
      }
      // Auto-set AWS bucket based on server if not explicitly provided
      const awsBucket = getBucketName(options.server);
      console.log(`🪣 AWS Bucket: ${awsBucket}`);

      // Create output directory
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      // Determine which folders to process
      let foldersToProcess: FolderStructure[] = [];

      if (options.month) {
        try {
          const monthsToProcess = parseMonthInput(options.month);

          // Validate all months after wildcard expansion
          const invalidMonths = monthsToProcess.filter((m) => !validateMonthFormat(m));
          if (invalidMonths.length > 0) {
            console.error(`❌ Invalid month format(s): ${invalidMonths.join(', ')}`);
            console.error(
              'Expected format: YYYY-MM (e.g., 2025-01) or wildcard pattern (e.g., 2025-*)',
            );
            process.exit(1);
          }

          // Convert months to content structures
          const monthStructures = monthsToProcess.map((month) =>
            getFolderStructure({ month, server: options.server }),
          );
          foldersToProcess.push(...monthStructures);
        } catch (error) {
          console.error(
            `❌ Error parsing month input: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      }

      if (options.batch) {
        // Process batch(es) - support ranges like "1-10" or comma-separated lists
        try {
          const batchesToProcess = parseBatchInput(options.batch);

          // Validate all batches
          const invalidBatches = batchesToProcess.filter((b) => !validateBatchFormat(b));
          if (invalidBatches.length > 0) {
            console.error(`❌ Invalid batch format(s): ${invalidBatches.join(', ')}`);
            console.error(
              'Expected format: single batch (e.g., "1"), range (e.g., "1-10"), or comma-separated list (e.g., "1,2,3")',
            );
            process.exit(1);
          }

          // Convert batches to content structures
          const batchStructures = batchesToProcess.map((batch) =>
            getFolderStructure({ batch, server: options.server }),
          );
          foldersToProcess.push(...batchStructures);
        } catch (error) {
          console.error(
            `❌ Error parsing batch input: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      }

      // Only generate month range if no other folders were specified
      if (foldersToProcess.length === 0) {
        // Generate month range and convert to content structures
        const monthRange = generateMonthRange();
        const monthStructures = monthRange.map((month) =>
          getFolderStructure({ month, server: options.server }),
        );
        foldersToProcess.push(...monthStructures);
      }

      // Remove duplicates and sort chronologically for all cases
      const uniqueFolders = removeDuplicateFolders(foldersToProcess);
      foldersToProcess = sortFoldersChronologically(uniqueFolders);

      console.log(`🚀 Starting processing for ${foldersToProcess.length} folders(s)`);
      console.log(`📅 Processing folders: ${foldersToProcess.map((s) => s.batch).join(', ')}`);

      const allStats: Array<{
        folderName: string;
        totalFiles: number;
        totalProcessed: number;
        newlyProcessed: number;
        alreadyProcessed: number;
        errors: number;
        filteredCount: number;
      }> = [];

      for (const folder of foldersToProcess) {
        const displayName =
          folder.type === 'back' ? `batch ${folder.batch}` : `month ${folder.batch}`;
        console.log(`\n📅 Processing ${displayName}`);

        const result = await processBatch(folder, options);

        if (!result.success) {
          console.error(`❌ Failed to process ${displayName}:`, result.error);
          // Continue with next folder instead of exiting
          continue;
        }

        // Collect statistics
        if (result.stats) {
          allStats.push(result.stats);
        }

        console.log(`✅ ${displayName} completed successfully`);
      }

      // Display summary table
      if (allStats.length > 0) {
        console.log('\n📊 Processing Summary');
        console.log('═'.repeat(80));
        console.log(
          'Folder'.padEnd(20) +
            'Total'.padStart(8) +
            'Processed'.padStart(12) +
            'New'.padStart(8) +
            'Cached'.padStart(8) +
            'Errors'.padStart(8) +
            'Filtered'.padStart(10),
        );
        console.log('─'.repeat(80));

        for (const stats of allStats) {
          const folderName = stats.folderName.padEnd(20);
          const total = stats.totalFiles.toString().padStart(8);
          const processed = stats.totalProcessed.toString().padStart(12);
          const newlyProcessed = stats.newlyProcessed.toString().padStart(8);
          const alreadyProcessed = stats.alreadyProcessed.toString().padStart(8);
          const errors = stats.errors.toString().padStart(8);
          const filtered = stats.filteredCount.toString().padStart(10);

          console.log(
            `${folderName}${total}${processed}${newlyProcessed}${alreadyProcessed}${errors}${filtered}`,
          );
        }
        console.log('─'.repeat(80));

        // Calculate totals
        const totalFiles = allStats.reduce((sum, stat) => sum + stat.totalFiles, 0);
        const totalProcessed = allStats.reduce((sum, stat) => sum + stat.totalProcessed, 0);
        const totalNewlyProcessed = allStats.reduce((sum, stat) => sum + stat.newlyProcessed, 0);
        const totalAlreadyProcessed = allStats.reduce(
          (sum, stat) => sum + stat.alreadyProcessed,
          0,
        );
        const totalErrors = allStats.reduce((sum, stat) => sum + stat.errors, 0);
        const totalFiltered = allStats.reduce((sum, stat) => sum + stat.filteredCount, 0);

        const totalFolderName = 'TOTAL'.padEnd(20);
        const totalTotal = totalFiles.toString().padStart(8);
        const totalProcessedStr = totalProcessed.toString().padStart(12);
        const totalNewlyProcessedStr = totalNewlyProcessed.toString().padStart(8);
        const totalAlreadyProcessedStr = totalAlreadyProcessed.toString().padStart(8);
        const totalErrorsStr = totalErrors.toString().padStart(8);
        const totalFilteredStr = totalFiltered.toString().padStart(10);

        console.log(
          `${totalFolderName}${totalTotal}${totalProcessedStr}${totalNewlyProcessedStr}${totalAlreadyProcessedStr}${totalErrorsStr}${totalFilteredStr}`,
        );
        console.log('═'.repeat(80));

        // Final summary message
        if (foldersToProcess.length > 1) {
          const summaryType = options.month ? 'batch processing' : 'backwards batch processing';
          console.log(`\n🎉 ${summaryType} completed!`);
          console.log(`📅 Processed ${foldersToProcess.length} folders`);
        } else {
          console.log(`\n🎉 Folder processing completed!`);
          console.log(`📅 Processed folder: ${foldersToProcess[0].batch}`);
        }
      }
    } catch (error) {
      console.error('❌ Error in batch processing:', error);
      process.exit(1);
    }
  });

/**
 * Process a single batch or month
 */
async function processBatch(
  folder: FolderStructure,
  options: BatchOptions,
): Promise<{
  success: boolean;
  error?: string;
  stats?: {
    folderName: string;
    totalFiles: number;
    totalProcessed: number;
    newlyProcessed: number;
    alreadyProcessed: number;
    errors: number;
    filteredCount: number;
  };
}> {
  try {
    // Step 1: List available MECA files for the folder
    const availableFiles = await listAvailableFiles(folder, options.limit, options);
    console.log(`📋 Found ${availableFiles.length} available files`);

    if (availableFiles.length === 0) {
      console.log('❌ No files found for the specified folder');
      return { success: false, error: 'No files found' };
    }

    // Step 2: Check which files are already processed
    const processingStatus = await checkProcessingStatus(
      availableFiles,
      options.apiUrl,
      folder,
      options.checkIndividualLimit,
    );

    let filesToProcess = options.force
      ? availableFiles
      : availableFiles.filter((file) => !processingStatus[file.s3Key]?.exists);

    // Apply file size filter if specified
    let filteredCount = 0;
    if (options.maxFileSize) {
      const maxSizeBytes = parseFileSize(options.maxFileSize);
      if (maxSizeBytes === null) {
        console.error(
          `❌ Invalid max file size format: ${options.maxFileSize}. Use format like "100MB" or "2GB"`,
        );
        process.exit(1);
      }

      const originalCount = filesToProcess.length;
      filesToProcess = filesToProcess.filter((file) => file.fileSize <= maxSizeBytes);
      filteredCount = originalCount - filesToProcess.length;

      if (filteredCount > 0) {
        console.log(
          `📏 File size filter: ${options.maxFileSize} max (${formatFileSize(maxSizeBytes)})`,
        );
        console.log(`🚫 Skipped ${filteredCount} files larger than ${options.maxFileSize}`);

        // Show size distribution of remaining files
        const remainingSizes = filesToProcess.map((f) => f.fileSize);
        const avgSize = remainingSizes.reduce((a, b) => a + b, 0) / remainingSizes.length;
        const maxSize = Math.max(...remainingSizes);
        console.log(
          `📊 Remaining files: avg ${formatFileSize(avgSize)}, max ${formatFileSize(maxSize)}`,
        );
      }
    }

    console.log(`📊 Files to process: ${filesToProcess.length}`);
    console.log(`✅ Already processed: ${availableFiles.length - filesToProcess.length}`);

    // Prepare statistics (for both dry-run and actual processing)
    const stats = {
      folderName: folder.batch,
      totalFiles: availableFiles.length,
      totalProcessed: availableFiles.length - filesToProcess.length, // already processed
      newlyProcessed: filesToProcess.length, // files that would be processed (for dry-run) or were processed (for actual)
      alreadyProcessed: availableFiles.length - filesToProcess.length,
      errors: 0, // will be updated during actual processing
      filteredCount: filteredCount,
    };

    if (options.dryRun) {
      console.log('\n📋 Files that would be processed:');
      filesToProcess.slice(0, 10).forEach((file) => {
        console.log(
          `  - ${file.s3Key} (${formatFileSize(file.fileSize)}, ${file.lastModified.toLocaleDateString()})`,
        );
      });
      if (filesToProcess.length > 10) {
        console.log(`  - ${filesToProcess.length - 10} more files...`);
      }
      return { success: true, stats };
    }

    // Step 3: Process files with concurrency control
    let processedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();

    // Create concurrency limiter
    const limit = pLimit(parseInt(options.concurrency.toString(), 10));

    console.log(
      `📦 Processing ${filesToProcess.length} files with concurrency limit of ${options.concurrency}`,
    );

    // Create array of processing functions
    const processingFunctions = filesToProcess.map((file) => {
      return limit(async () => {
        try {
          console.log(`  📥 Starting ${file.s3Key}...`);

          // Download the MECA file first
          await downloadFile(file.s3Key, {
            output: options.output,
            server: options.server,
          });

          // Get the local file path
          const localFilePath = path.join(options.output, path.basename(file.s3Key));

          // Get API key from command line or environment variable
          const apiKey = options.apiKey || process.env.BIORXIV_API_KEY;

          // Process the MECA file using the utility function
          const result = await processMecaFile(localFilePath, {
            batch: file.batch,
            server: folder.server,
            apiUrl: options.apiUrl,
            output: options.output,
            s3Key: file.s3Key, // Pass the full S3 key for database storage
            apiKey,
            selective: !options.fullExtract, // Enable selective extraction unless --full-extract is used
          });

          // Clean up files after processing
          await cleanupFiles(localFilePath, file, options);

          if (result.success) {
            console.log(`  ✅ Successfully processed: ${file.s3Key}`);
            return { success: true, file, localFilePath };
          } else {
            console.log(`  ❌ Failed to process: ${file.s3Key} - ${result.error}`);
            return { success: false, file, localFilePath, error: result.error };
          }
        } catch (error) {
          console.error(`  ❌ Error processing ${file.s3Key}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, file, localFilePath: null, error: errorMessage };
        }
      });
    });

    // Process all files with concurrency control
    const results = await Promise.all(processingFunctions);

    // Process results and cleanup
    for (const result of results) {
      if (result && typeof result === 'object' && 'success' in result) {
        const { success } = result;
        if (success) {
          processedCount++;
        } else {
          errorCount++;
        }
      } else {
        // Invalid result format
        errorCount++;
        console.error(`  ❌ Invalid result format:`, result);
      }
    }

    // Show final progress
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const avgTimePerFile = processedCount > 0 ? elapsed / processedCount : 0;

    console.log(
      `📊 Processing complete. Progress: ${processedCount}/${filesToProcess.length} (${Math.round((processedCount / filesToProcess.length) * 100)}%)`,
    );
    console.log(`⏱️  Elapsed: ${elapsed}s, Avg: ${avgTimePerFile.toFixed(1)}s/file`);

    // Summary
    console.log(`\n🎉 Batch processing completed!`);
    console.log(`📊 Total files: ${availableFiles.length}`);
    console.log(`✅ Successfully processed: ${processedCount}`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount}`);
    }
    console.log(
      `⏭️  Skipped (already processed): ${availableFiles.length - filesToProcess.length}`,
    );

    // Show file size filtering summary if any files were filtered
    if (filteredCount > 0) {
      console.log(`🚫 Skipped ${filteredCount} files larger than ${options.maxFileSize}`);
    }

    // Cleanup summary
    if (!options.keep) {
      console.log(`🧹 Cleanup: MECA files and extracted content removed`);
    } else {
      console.log(`💾 Cleanup: MECA files and extracted content preserved`);
    }

    // Update statistics with actual processing results
    stats.newlyProcessed = processedCount;
    stats.totalProcessed = availableFiles.length - filesToProcess.length + processedCount; // already processed + newly processed
    stats.errors = errorCount;

    return { success: true, stats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Clean up files after processing
 */
async function cleanupFiles(
  localFilePath: string | null,
  file: S3FileInfo,
  options: BatchOptions,
): Promise<void> {
  if (!localFilePath) return;

  try {
    if (!options.keep) {
      // Remove the downloaded MECA file
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log(`    🧹 Cleaned up MECA file: ${path.basename(file.s3Key)}`);
      }

      // Also clean up any extracted content directory
      const extractedDir = localFilePath.replace('.meca', '');
      if (fs.existsSync(extractedDir)) {
        fs.rmSync(extractedDir, { recursive: true, force: true });
        console.log(`    🧹 Cleaned up extracted content: ${path.basename(extractedDir)}`);
      }

      // Clean up any temporary files that might have been created
      const tempFiles = [
        localFilePath + '.tmp',
        localFilePath + '.download',
        path.dirname(localFilePath) + '/.temp_' + path.basename(localFilePath),
      ];

      for (const tempFile of tempFiles) {
        if (fs.existsSync(tempFile)) {
          try {
            if (fs.statSync(tempFile).isDirectory()) {
              fs.rmSync(tempFile, { recursive: true, force: true });
            } else {
              fs.unlinkSync(tempFile);
            }
            console.log(`    🧹 Cleaned up temp file: ${path.basename(tempFile)}`);
          } catch (tempError) {
            // Ignore temp file cleanup errors
          }
        }
      }
    } else {
      console.log(`    💾 Keeping MECA file: ${path.basename(file.s3Key)}`);

      // Even when keeping files, clean up extracted content if it's not needed
      if (!options.keep) {
        try {
          const extractedDir = localFilePath.replace('.meca', '');
          if (fs.existsSync(extractedDir)) {
            fs.rmSync(extractedDir, { recursive: true, force: true });
            console.log(
              `    🧹 Cleaned up extracted content (keeping MECA): ${path.basename(extractedDir)}`,
            );
          }
        } catch (cleanupError) {
          // Ignore extracted content cleanup errors when keeping MECA
        }
      }
    }
  } catch (cleanupError) {
    console.warn(`    ⚠️  Warning: Could not clean up files for ${file.s3Key}:`, cleanupError);
  }
}

async function listAvailableFiles(
  folder: FolderStructure,
  limit: number | undefined,
  options: BatchOptions,
): Promise<S3FileInfo[]> {
  // If no limit specified, use a very large number to get all files
  const actualLimit = limit || 999999;

  return listMonthFiles({
    month: folder.type === 'current' ? folder.batch : undefined,
    batch: folder.type === 'back' ? folder.batch : undefined,
    server: options.server,
    limit: actualLimit,
  });
}

/**
 * Check the processing status of individual files.
 *
 * This is necessary if the list coming back from a large query misses some files.
 */
async function checkIndividualProcessingStatus(
  files: S3FileInfo[],
  apiUrl: string,
  status: Record<string, { exists: boolean; paper?: any }>,
): Promise<void> {
  console.log('  🔍 Performing individual file status checks...');

  // Create a concurrency limiter for API requests
  const limit = pLimit(10);

  // Create array of checking functions
  const checkingFunctions = files.map((file) => {
    return limit(async () => {
      try {
        // Check individual file status using the bucket endpoint
        const response = await axios.get(
          `${apiUrl}/v1/bucket?key=${encodeURIComponent(file.s3Key)}`,
        );

        if (response.status === 200 && response.data) {
          // File exists and has data
          status[file.s3Key] = { exists: true, paper: response.data };
          console.log(`    ✅ ${file.s3Key} - Found in database`);
        } else {
          // File not found or no data
          status[file.s3Key] = { exists: false };
          console.log(`    ❌ ${file.s3Key} - Not found in database`);
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          // File not found
          status[file.s3Key] = { exists: false };
          console.log(`    ❌ ${file.s3Key} - Not found in database (404)`);
        } else {
          // Other error - assume not processed
          status[file.s3Key] = { exists: false };
          console.log(`    ⚠️  ${file.s3Key} - Error checking status: ${error.message}`);
        }
      }
    });
  });

  // Execute all checks concurrently
  await Promise.all(checkingFunctions);

  const processedCount = Object.values(status).filter((s) => s.exists).length;
  console.log(
    `  📊 Individual check complete: ${processedCount}/${files.length} files actually processed`,
  );
}

async function checkProcessingStatus(
  files: S3FileInfo[],
  apiUrl: string,
  folder: FolderStructure,
  checkIndividualLimit: number = 100,
): Promise<Record<string, { exists: boolean; paper?: any }>> {
  const status: Record<string, { exists: boolean; paper?: any }> = {};
  const processedFiles = new Set<string>();

  console.log('🔍 Checking processing status using batch endpoint...');

  // Use the folder.batch directly instead of trying to extract month from S3 keys
  const folderParam = folder.batch;

  let offset = 0;
  const limit = 1000; // Use the API's default limit
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await axios.get(
        `${apiUrl}/v1/bucket/list?folder=${encodeURIComponent(folderParam)}&server=${folder.server}&limit=${limit}&offset=${offset}`,
      );

      const { items: batchItems, pagination } = response.data;

      // Mark all files in this batch as processed
      for (const item of batchItems) {
        if (item.s3Key) {
          processedFiles.add(item.s3Key);
          status[item.s3Key] = { exists: true, paper: item };
        }
      }

      // Check if we have more pages
      hasMore = pagination.hasMore;
      offset = pagination.nextOffset || offset + limit;

      console.log(
        `  📄 Processed batch page: ${batchItems.length} items (offset: ${pagination.offset})`,
      );
    } catch (error) {
      console.warn(`⚠️  Error fetching batch at offset ${offset}:`, error);
      hasMore = false;
    }
  }

  // Now check which of our requested files exist in the processed set
  const finalStatus: Record<string, { exists: boolean; paper?: any }> = {};

  for (const file of files) {
    if (processedFiles.has(file.s3Key)) {
      finalStatus[file.s3Key] = status[file.s3Key];
    } else {
      finalStatus[file.s3Key] = { exists: false };
    }
  }

  console.log(`  ✅ Found ${processedFiles.size} processed items in batch`);
  console.log(
    `  📊 Requested files status: ${Object.values(finalStatus).filter((s) => s.exists).length}/${files.length} already processed`,
  );

  const filesToCheck = files.filter((file) => !finalStatus[file.s3Key]?.exists);

  // If individual checking is enabled and we have fewer files than the limit, do individual checks
  if (filesToCheck.length > 0 && filesToCheck.length < checkIndividualLimit) {
    console.log(
      `🔍 Individual checking enabled (${filesToCheck.length} files < ${checkIndividualLimit} limit)`,
    );
    await checkIndividualProcessingStatus(filesToCheck, apiUrl, finalStatus);
  }

  return finalStatus;
}

function parseFileSize(sizeStr: string): number | null {
  if (!sizeStr) return null;

  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return value * multipliers[unit];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
