import { Command, Option } from 'commander';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { listMonthFiles, type S3FileInfo } from '../aws/month-lister.js';
import { downloadFile } from '../aws/downloader.js';
import { processMecaFile } from '../utils/meca-processor.js';

interface BatchOptions {
  month: string;
  limit: number;
  apiUrl: string;
  apiKey?: string;
  output: string;
  dryRun: boolean;
  force: boolean;
  keep: boolean;
  fullExtract: boolean;
  awsBucket: string;
  awsRegion: string;
}

export const batchProcessCommand = new Command('batch-process')
  .description(
    'Batch process MECA files for a given month. Use --keep to preserve downloaded files.',
  )
  .option('-m, --month <month>', 'Month to process (YYYY-MM format)', '2025-01')
  .option('-l, --limit <number>', 'Maximum number of files to process', '10')
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
      console.log(`📊 Processing limit: ${options.limit} files`);
      console.log(`🔍 Dry run mode: ${options.dryRun ? 'enabled' : 'disabled'}`);

      // Create output directory
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      // Step 1: List available MECA files for the month
      const availableFiles = await listAvailableFiles(options.month, options.limit, options);
      console.log(`📋 Found ${availableFiles.length} available files`);

      if (availableFiles.length === 0) {
        console.log('❌ No files found for the specified month');
        return;
      }

      // Step 2: Check which files are already processed
      const processingStatus = await checkProcessingStatus(
        availableFiles,
        options.apiUrl,
        options.month,
      );

      const filesToProcess = options.force
        ? availableFiles
        : availableFiles.filter((file) => !processingStatus[file.s3Key]?.exists);

      console.log(`📊 Files to process: ${filesToProcess.length}`);
      console.log(`✅ Already processed: ${availableFiles.length - filesToProcess.length}`);

      if (options.dryRun) {
        console.log('\n📋 Files that would be processed:');
        filesToProcess.forEach((file) => {
          console.log(
            `  - ${file.s3Key} (${formatFileSize(file.fileSize)}, ${file.lastModified.toLocaleDateString()})`,
          );
        });
        return;
      }

      // Step 3: Process files
      let processedCount = 0;
      let errorCount = 0;

      for (const file of filesToProcess) {
        try {
          console.log(`\n🔄 Processing ${file.s3Key}...`);

          // Download the MECA file first
          console.log(`  📥 Downloading ${file.s3Key} from S3...`);
          await downloadFile(file.s3Key, {
            output: options.output,
          });

          // Get the local file path
          const localFilePath = path.join(options.output, path.basename(file.s3Key));
          console.log(`  💾 Downloaded to: ${localFilePath}`);

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

          if (result.success) {
            console.log(`✅ Successfully processed: ${file.s3Key}`);
            processedCount++;
          } else {
            console.log(`❌ Failed to process: ${file.s3Key} - ${result.error}`);
            errorCount++;
          }

          // Clean up downloaded MECA file unless --keep flag is set
          if (!options.keep) {
            try {
              // Remove the downloaded MECA file
              if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                console.log(`  🧹 Cleaned up MECA file: ${path.basename(file.s3Key)}`);
              }

              // Also clean up any extracted content directory
              const extractedDir = localFilePath.replace('.meca', '');
              if (fs.existsSync(extractedDir)) {
                fs.rmSync(extractedDir, { recursive: true, force: true });
                console.log(`  🧹 Cleaned up extracted content: ${path.basename(extractedDir)}`);
              }
            } catch (cleanupError) {
              console.warn(
                `  ⚠️  Warning: Could not clean up files for ${file.s3Key}:`,
                cleanupError,
              );
            }
          } else {
            console.log(`  💾 Keeping MECA file: ${path.basename(file.s3Key)}`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${file.s3Key}:`, error);
          errorCount++;
        }

        // Check if we've reached the limit
        if (processedCount >= options.limit) {
          console.log(`\n🛑 Reached processing limit of ${options.limit} files`);
          break;
        }
      }

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

      // Cleanup summary
      if (!options.keep) {
        console.log(`🧹 Cleanup: MECA files and extracted content removed`);
      } else {
        console.log(`💾 Cleanup: MECA files and extracted content preserved`);
      }
    } catch (error) {
      console.error('❌ Error in batch processing:', error);
      process.exit(1);
    }
  });

async function listAvailableFiles(
  month: string,
  limit: number,
  options: BatchOptions,
): Promise<S3FileInfo[]> {
  return listMonthFiles({
    month,
    limit,
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
  const limit = 100; // Use the API's default limit
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
