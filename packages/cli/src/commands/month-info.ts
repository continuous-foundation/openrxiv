import { Command } from 'commander';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import chalk from 'chalk';
import { getS3Client } from '../aws/config.js';
import { getContentStructure } from '../utils/content-structure.js';
import { getBucketName } from '../aws/bucket-explorer.js';

export const monthInfoCommand = new Command('month-info')
  .description(
    'List detailed metadata for all files in a specific month or batch from bioRxiv or medRxiv',
  )
  .option('-m, --month <month>', 'Month to list (e.g., "January_2024" or "2024-01")')
  .option('-b, --batch <batch>', 'Batch to list (e.g., "1", "batch-1", "Batch_01")')
  .option('-s, --server <server>', 'Server to use: "biorxiv" or "medrxiv"', 'biorxiv')
  .action(async (options) => {
    try {
      await listMonthMetadata(options);
    } catch (error) {
      console.error('Error listing month metadata:', error);
      process.exit(1);
    }
  });

interface FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  type: 'meca' | 'pdf' | 'xml' | 'other';
  fileName: string;
  fileExtension: string;
}

async function listMonthMetadata(options: {
  month?: string;
  batch?: string;
  server?: 'biorxiv' | 'medrxiv';
}): Promise<void> {
  const client = await getS3Client();
  const { month, batch, server = 'biorxiv' } = options;
  const bucketName = getBucketName(server);

  if (!month && !batch) {
    console.error('❌ Error: Either --month or --batch option must be specified');
    process.exit(1);
  }

  // Determine content structure based on options
  const contentStructure = getContentStructure({ month, batch, server });
  const prefix = contentStructure.prefix;

  const description = month ? `Month: ${month}` : `Batch: ${batch}`;
  console.log(chalk.blue(`📅 Month/Batch Information: ${description}`));
  console.log(chalk.blue('===================================='));
  console.log(
    chalk.gray(
      `🔍 Content Type: ${contentStructure.type === 'current' ? 'Current Content' : 'Back Content'}`,
    ),
  );
  if (contentStructure.batch) {
    console.log(chalk.gray(`🔍 Batch: ${contentStructure.batch}`));
  }
  console.log(chalk.gray(`🔍 Scanning S3 prefix: ${prefix}`));
  console.log('');

  const allFiles: FileMetadata[] = [];
  let continuationToken: string | undefined;
  let batchCount = 0;

  try {
    // Use pagination to get all files
    do {
      batchCount++;
      console.log(chalk.gray(`📦 Fetching batch ${batchCount}...`));

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
        RequestPayer: 'requester',
      });

      const response = await client.send(command);

      if (response.Contents) {
        for (const item of response.Contents) {
          if (!item.Key) continue;

          const type = getContentType(item.Key);

          allFiles.push({
            key: item.Key,
            size: item.Size || 0,
            lastModified: item.LastModified || new Date(),
            type,
            fileName: item.Key.split('/').pop() || 'unknown',
            fileExtension: item.Key.split('.').pop() || 'none',
          });
        }
      }

      continuationToken = response.NextContinuationToken;

      if (response.Contents) {
        console.log(chalk.gray(`   Found ${response.Contents.length} files in this batch`));
      }
    } while (continuationToken);

    console.log(chalk.green(`✅ Total files found: ${allFiles.length}`));
    console.log('');

    displaySummary(allFiles, month || batch || 'unknown', server);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to list month metadata: ${error.message}`);
    }
    throw error;
  }
}

function getContentType(key: string): 'meca' | 'pdf' | 'xml' | 'other' {
  if (key.endsWith('.meca')) return 'meca';
  if (key.endsWith('.pdf')) return 'pdf';
  if (key.endsWith('.xml')) return 'xml';
  return 'other';
}

function displaySummary(files: FileMetadata[], month: string, server: string = 'biorxiv'): void {
  console.log(chalk.blue.bold('📊 Summary Statistics'));
  console.log(chalk.blue('===================='));
  console.log('');

  // Show content structure info if available
  try {
    const contentStructure = getContentStructure({ month, server });
    console.log(chalk.cyan('📁 Content Structure:'));
    console.log(
      `   Type: ${chalk.yellow(contentStructure.type === 'current' ? 'Current Content' : 'Back Content')}`,
    );
    if (contentStructure.batch) {
      console.log(`   Batch: ${chalk.yellow(contentStructure.batch)}`);
    }
    console.log('');
  } catch (error) {
    // Ignore errors in summary display
  }

  // File type breakdown
  const typeCounts = files.reduce(
    (acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log(chalk.cyan('📁 File Types:'));
  for (const [type, count] of Object.entries(typeCounts)) {
    const percentage = ((count / files.length) * 100).toFixed(1);
    console.log(`   ${chalk.yellow(type.toUpperCase())}: ${chalk.green(count)} (${percentage}%)`);
  }
  console.log('');

  // Size statistics
  const mecaFiles = files.filter((f) => f.type === 'meca');
  if (mecaFiles.length > 0) {
    const sizes = mecaFiles.map((f) => f.size);
    const totalSize = sizes.reduce((sum, size) => sum + size, 0);
    const avgSize = totalSize / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);

    console.log(chalk.cyan('📦 MECA File Sizes:'));
    console.log(`   Total: ${chalk.green(formatFileSize(totalSize))}`);
    console.log(`   Average: ${chalk.green(formatFileSize(avgSize))}`);
    console.log(
      `   Range: ${chalk.green(formatFileSize(minSize))} - ${chalk.green(formatFileSize(maxSize))}`,
    );
    console.log('');
  }

  // Date range
  const dates = files.map((f) => f.lastModified);
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())));

  console.log(chalk.cyan('📅 Upload Date Range:'));
  console.log(`   Earliest: ${chalk.green(earliest.toLocaleDateString())}`);
  console.log(`   Latest: ${chalk.green(latest.toLocaleDateString())}`);
  console.log('');

  // Upload date histogram
  const sortedDates = displayUploadDateHistogram(files);
  console.log('');

  // Show batch analysis
  console.log('');
  analyzeBatchPatterns(sortedDates);
}

function displayUploadDateHistogram(files: FileMetadata[]): [string, number][] {
  console.log(chalk.cyan('📊 Upload Date Distribution:'));
  console.log(chalk.cyan('============================'));
  console.log('');

  // Group files by date
  const dateGroups = new Map<string, number>();

  for (const file of files) {
    const dateKey = file.lastModified.toLocaleDateString();
    dateGroups.set(dateKey, (dateGroups.get(dateKey) || 0) + 1);
  }

  // Sort dates chronologically
  const sortedDates = Array.from(dateGroups.entries()).sort((a, b) => {
    return new Date(a[0]).getTime() - new Date(b[0]).getTime();
  });

  // Find the maximum count for scaling
  const maxCount = Math.max(...Array.from(dateGroups.values()));
  const maxBarLength = 50; // Maximum bar length in characters

  // Display histogram
  for (const [date, count] of sortedDates) {
    const barLength = Math.round((count / maxCount) * maxBarLength);
    const bar = '█'.repeat(barLength);
    const percentage = ((count / files.length) * 100).toFixed(1);

    // Color code by upload volume
    let countColor = chalk.green;
    if (count > maxCount * 0.8) {
      countColor = chalk.red; // High volume
    } else if (count > maxCount * 0.5) {
      countColor = chalk.yellow; // Medium volume
    } else {
      countColor = chalk.green; // Low volume
    }

    console.log(
      `${chalk.cyan(date.padStart(10))} ${countColor(count.toString().padStart(4))} ${chalk.gray('│')} ${chalk.blue(bar)} ${chalk.gray(`(${percentage}%)`)}`,
    );
  }

  return sortedDates;
}

function analyzeBatchPatterns(dateGroups: [string, number][]): void {
  console.log(chalk.cyan('🔍 Batch Analysis'));
  console.log(chalk.cyan('================='));
  console.log('');

  if (dateGroups.length === 0) return;

  // Analyze upload patterns
  const totalDays = dateGroups.length;
  const totalFiles = dateGroups.reduce((sum, [, count]) => sum + count, 0);
  const avgFilesPerDay = totalFiles / totalDays;

  console.log(`   Total active days: ${chalk.green(totalDays)}`);
  console.log(`   Average files per day: ${chalk.green(avgFilesPerDay.toFixed(1))}`);
  console.log('');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
