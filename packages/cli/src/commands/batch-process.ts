import { Command, Option } from 'commander';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pLimit from 'p-limit';
import { listMonthFiles, type S3FileInfo } from '../aws/month-lister.js';
import { downloadFile } from '../aws/downloader.js';
import { processMecaFile } from '../utils/meca-processor.js';
import {
  generateMonthRange,
  parseMonthInput,
  validateMonthFormat,
  sortMonthsChronologically,
  removeDuplicateMonths,
} from '../utils/index.js';

interface BatchOptions {
  month: string;
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
  awsBucket: string;
  awsRegion: string;
}

export const batchProcessCommand = new Command('batch-process')
  .description(
    'Batch process MECA files for a given month. Use --keep to preserve downloaded files.',
  )
  .option(
    '-m, --month <month>',
    'Month(s) to process. Supports: YYYY-MM, comma-separated list (2025-01,2025-02), or wildcard pattern (2025-*). If not specified, processes backwards from current month to 2018-12',
  )
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
  .option('--aws-bucket <bucket>', 'AWS S3 bucket name', 'biorxiv-src-monthly')
  .option('--aws-region <region>', 'AWS region', 'us-east-1')
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
      console.log(`🚀 Starting batch processing for month: ${options.month}`);
      console.log(
        `📊 Processing limit: ${options.limit ? `${options.limit} files` : 'all available files'}`,
      );
      console.log(`🔍 Dry run mode: ${options.dryRun ? 'enabled' : 'disabled'}`);
      console.log(`⚡ Concurrency: ${options.concurrency} files`);

      // Create output directory
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      // Determine which months to process
      let monthsToProcess: string[];

      if (options.month) {
        try {
          monthsToProcess = parseMonthInput(options.month);

          // Validate all months
          const invalidMonths = monthsToProcess.filter((m) => !validateMonthFormat(m));
          if (invalidMonths.length > 0) {
            console.error(`❌ Invalid month format(s): ${invalidMonths.join(', ')}`);
            console.error('Expected format: YYYY-MM (e.g., 2025-01)');
            process.exit(1);
          }

          // Remove duplicates and sort chronologically
          monthsToProcess = removeDuplicateMonths(monthsToProcess);
          monthsToProcess = sortMonthsChronologically(monthsToProcess);

          console.log(`🚀 Starting batch processing for ${monthsToProcess.length} month(s)`);
          console.log(`📅 Processing months: ${monthsToProcess.join(', ')}`);
        } catch (error) {
          console.error(
            `❌ Error parsing month input: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      } else {
        monthsToProcess = generateMonthRange();
        console.log(`🚀 Starting backwards batch processing for ${monthsToProcess.length} months`);
        console.log(`📅 Processing months: ${monthsToProcess.join(', ')}`);
        console.log(`📅 Range: from current month back to 2018-12`);
      }

      for (const month of monthsToProcess) {
        console.log(`\n📅 Processing month: ${month}`);

        const result = await processMonth(month, options);

        if (!result.success) {
          console.error(`❌ Failed to process month ${month}:`, result.error);
          // Continue with next month instead of exiting
          continue;
        }

        // Update totals (these will be populated by processMonth)
        // For now, we'll just track that the month was processed
        console.log(`✅ Month ${month} completed successfully`);
      }

      // Final summary across all months
      if (monthsToProcess.length > 1) {
        const summaryType = options.month ? 'batch processing' : 'backwards batch processing';
        console.log(`\n🎉 ${summaryType} completed!`);
        console.log(`📅 Processed ${monthsToProcess.length} months`);
        console.log(`📊 Total months processed: ${monthsToProcess.length}`);
      } else {
        console.log(`\n🎉 Month processing completed!`);
        console.log(`📅 Processed month: ${monthsToProcess[0]}`);
      }
    } catch (error) {
      console.error('❌ Error in batch processing:', error);
      process.exit(1);
    }
  });

/**
 * Process a single month
 */
async function processMonth(
  month: string,
  options: BatchOptions,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: List available MECA files for the month
    const availableFiles = await listAvailableFiles(month, options.limit, options);
    console.log(`📋 Found ${availableFiles.length} available files`);

    if (availableFiles.length === 0) {
      console.log('❌ No files found for the specified month');
      return { success: false, error: 'No files found' };
    }

    // Step 2: Check which files are already processed
    const processingStatus = await checkProcessingStatus(availableFiles, options.apiUrl, month);

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

    if (options.dryRun) {
      console.log('\n📋 Files that would be processed:');
      filesToProcess.forEach((file) => {
        console.log(
          `  - ${file.s3Key} (${formatFileSize(file.fileSize)}, ${file.lastModified.toLocaleDateString()})`,
        );
      });
      return { success: true };
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
          });

          // Get the local file path
          const localFilePath = path.join(options.output, path.basename(file.s3Key));

          // Get API key from command line or environment variable
          const apiKey = options.apiKey || process.env.BIORXIV_API_KEY;

          // Process the MECA file using the utility function
          const result = await processMecaFile(localFilePath, {
            batch: file.batch,
            server: 'biorxiv',
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

    return { success: true };
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
  month: string,
  limit: number | undefined,
  options: BatchOptions,
): Promise<S3FileInfo[]> {
  // If no limit specified, use a very large number to get all files
  const actualLimit = limit || 999999;

  return listMonthFiles({
    month,
    limit: actualLimit,
    awsBucket: options.awsBucket,
    awsRegion: options.awsRegion,
  });
}

async function checkProcessingStatus(
  files: S3FileInfo[],
  apiUrl: string,
  month: string,
): Promise<Record<string, { exists: boolean; paper?: any }>> {
  const status: Record<string, { exists: boolean; paper?: any }> = {};
  const processedFiles = new Set<string>();

  console.log('🔍 Checking processing status using batch endpoint...');

  // Extract month from the first file's S3 key to determine the batch
  // Format should be something like "2025-01/..." so we extract "2025-01"
  const monthFromFiles = month || files[0]?.s3Key.split('/')[0];

  if (!monthFromFiles || !/^\d{4}-\d{2}$/.test(monthFromFiles)) {
    console.warn('⚠️  Could not determine month from files, falling back to individual requests');
    return checkProcessingStatusIndividual(files, apiUrl);
  }

  let offset = 0;
  const limit = 1000; // Use the API's default limit
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await axios.get(
        `${apiUrl}/v1/bucket/list?month=${monthFromFiles}&limit=${limit}&offset=${offset}`,
      );

      const { files: batchFiles, pagination } = response.data;

      // Mark all files in this batch as processed
      for (const file of batchFiles) {
        if (file.s3Key) {
          processedFiles.add(file.s3Key);
          status[file.s3Key] = { exists: true, paper: file };
        }
      }

      // Check if we have more pages
      hasMore = pagination.hasMore;
      offset = pagination.nextOffset || offset + limit;

      console.log(
        `  📄 Processed batch page: ${batchFiles.length} files (offset: ${pagination.offset})`,
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

  console.log(`  ✅ Found ${processedFiles.size} processed files in batch`);
  console.log(
    `  📊 Requested files status: ${Object.values(finalStatus).filter((s) => s.exists).length}/${files.length} already processed`,
  );

  return finalStatus;
}

async function checkProcessingStatusIndividual(
  files: S3FileInfo[],
  apiUrl: string,
): Promise<Record<string, { exists: boolean; paper?: any }>> {
  const status: Record<string, { exists: boolean; paper?: any }> = {};

  console.log('  🔍 Falling back to individual file checks...');

  for (const file of files) {
    try {
      const response = await axios.get(`${apiUrl}/v1/bucket?key=${encodeURIComponent(file.s3Key)}`);
      status[file.s3Key] = { exists: true, paper: response.data };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        status[file.s3Key] = { exists: false };
      } else {
        console.warn(`⚠️  Could not check status for ${file.s3Key}`);
        status[file.s3Key] = { exists: false };
      }
    }
  }

  return status;
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
