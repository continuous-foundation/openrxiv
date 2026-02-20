import { ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import { getS3Client } from './config.js';
import { getFolderStructure } from 'openrxiv-utils';
import { getDefaultServer } from '../utils/default-server.js';

/**
 * Get the S3 bucket name based on the server
 */
export function getBucketName(server: 'biorxiv' | 'medrxiv' = getDefaultServer()): string {
  switch (server.toLowerCase()) {
    case 'medrxiv':
      return 'medrxiv-src-monthly';
    case 'biorxiv':
      return 'biorxiv-src-monthly';
    default:
      console.error(`❌ Error: Invalid server ${server}, must be "biorxiv" or "medrxiv"`);
      process.exit(1);
  }
}

export interface ListOptions {
  month?: string;
  batch?: string;
  limit?: number;
  server?: 'biorxiv' | 'medrxiv';
  output?: string;
}

export interface SearchOptions {
  type?: 'pdf' | 'xml' | 'all';
  limit?: number;
}

export interface ContentItem {
  key: string;
  size: number;
  lastModified: Date;
  type: 'meca' | 'pdf' | 'xml' | 'other';
}

export async function listBucketContent(options: ListOptions): Promise<void> {
  const client = await getS3Client();
  const { month, batch, limit = 50, server = getDefaultServer(), output } = options;
  const bucketName = getBucketName(server);

  console.log(chalk.blue(`Listing ${server} bucket content...`));
  console.log(chalk.blue('===================================='));

  try {
    // If no month or batch specified, show the available content structure
    if (!month && !batch) {
      await listFolder(client, server, output);
      return;
    }

    let prefix = '';
    let folder = null;

    if (month || batch) {
      // Use folder structure utility to determine the correct prefix
      folder = getFolderStructure({ month, batch, server });
      prefix = folder.prefix;

      console.log(
        chalk.gray(
          `🔍 Content Type: ${folder.type === 'current' ? 'Current Content' : 'Back Content'}`,
        ),
      );
      if (folder.batch) {
        console.log(chalk.gray(`🔍 Batch: ${folder.batch}`));
      }
    }

    // Collect all items across pages
    const allItems: Array<{ Key: string; Size?: number; LastModified?: Date }> = [];
    let continuationToken: string | undefined = undefined;
    const maxKeysPerRequest = 1000; // S3 maximum
    const requestedLimit = parseInt(limit.toString());
    let pageNumber = 1;

    // Prepare data for CSV export if output is specified
    const csvRows: string[] = [];
    if (output) {
      csvRows.push('Key,Size (bytes),Date Modified');
    }

    // Paginate through all results, respecting the limit
    do {
      const remainingItems = requestedLimit - allItems.length;
      const keysToFetch = Math.min(maxKeysPerRequest, remainingItems);

      if (keysToFetch <= 0) {
        break;
      }

      // Show progress when exporting to CSV
      if (output) {
        console.log(chalk.gray(`📄 Fetching page ${pageNumber}...`));
      }

      const commandOptions: any = {
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: keysToFetch,
        RequestPayer: 'requester',
      };

      if (continuationToken) {
        commandOptions.ContinuationToken = continuationToken;
      }

      const command = new ListObjectsV2Command(commandOptions);
      const response = await client.send(command);

      if (response.Contents && response.Contents.length > 0) {
        const validItems = response.Contents.filter((item) => item.Key !== undefined).map(
          (item) => ({
            Key: item.Key!,
            Size: item.Size,
            LastModified: item.LastModified,
          }),
        );

        const itemsToAdd = validItems.slice(0, remainingItems);
        allItems.push(...itemsToAdd);

        if (output) {
          console.log(
            chalk.gray(
              `   ✓ Page ${pageNumber}: ${itemsToAdd.length} items (Total: ${allItems.length})`,
            ),
          );
        }
      }

      if (allItems.length >= requestedLimit) {
        break;
      }

      continuationToken = response.NextContinuationToken;
      pageNumber++;
    } while (continuationToken && allItems.length < requestedLimit);

    if (allItems.length === 0) {
      console.log(chalk.yellow('No content found'));
      return;
    }

    const escapeCsvValue = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    if (!output) {
      console.log(chalk.green(`Found ${allItems.length} items:`));
      console.log('');
    }

    for (const item of allItems) {
      if (!item.Key) continue;

      const type = getContentType(item.Key);
      const size = formatFileSize(item.Size || 0);
      const date = item.LastModified ? item.LastModified.toLocaleDateString() : 'Unknown';
      const sizeBytes = item.Size || 0;
      const dateModified = item.LastModified ? item.LastModified.toISOString() : 'Unknown';

      if (!output) {
        console.log(`${chalk.cyan(item.Key)}`);
        console.log(
          `  Type: ${chalk.yellow(type)} | Size: ${chalk.blue(size)} | Modified: ${chalk.gray(date)}`,
        );
        console.log('');
      }

      if (output) {
        csvRows.push(`${escapeCsvValue(item.Key)},${sizeBytes},${escapeCsvValue(dateModified)}`);
      }
    }

    if (output) {
      const csvContent = csvRows.join('\n');
      const csvFileName = output.endsWith('.csv') ? output : `${output}.csv`;
      await writeFile(csvFileName, csvContent, 'utf-8');
      console.log(chalk.green(`✅ Exported ${allItems.length} items to ${csvFileName}`));
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to list bucket content: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Lists the available content structure in the specified server bucket
 * Shows available months and batches
 */
async function listFolder(
  client: S3Client,
  server: 'biorxiv' | 'medrxiv' = getDefaultServer(),
  output?: string,
): Promise<void> {
  const folderNames: string[] = [];

  if (!output) {
    console.log(chalk.cyan('📁 Available Content Structure'));
    console.log(chalk.cyan('=============================='));
    console.log('');
  }

  try {
    if (!output) {
      console.log(chalk.blue('📅 Current Content (Monthly):'));
      console.log(chalk.gray('   Recent content organized by month'));
      console.log('');
    }

    const bucketName = getBucketName(server);
    const currentContentCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'Current_Content/',
      Delimiter: '/',
      MaxKeys: 1000,
      RequestPayer: 'requester',
    });

    const currentResponse = await client.send(currentContentCommand);

    if (currentResponse.CommonPrefixes && currentResponse.CommonPrefixes.length > 0) {
      const months = currentResponse.CommonPrefixes.map((prefix) =>
        prefix.Prefix?.replace('Current_Content/', '').replace('/', ''),
      )
        .filter(Boolean)
        .sort((a, b) => {
          // Sort by year first, then by month
          const [monthA, yearA] = a!.split('_');
          const [monthB, yearB] = b!.split('_');
          if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA); // Newest year first
          const monthOrder = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
          ];
          return monthOrder.indexOf(monthB) - monthOrder.indexOf(monthA);
        });

      for (const month of months) {
        if (output) {
          folderNames.push(month!);
        } else {
          console.log(`   ${chalk.green('📁')} ${chalk.cyan(month)}`);
        }
      }
    } else {
      if (!output) {
        console.log(chalk.gray('   No monthly content found'));
      }
    }

    if (!output) {
      console.log('');

      // List Back_Content batches
      console.log(chalk.blue('📦 Back Content (Historical Batches):'));
      console.log(chalk.gray('   Legacy content organized in batches'));
      console.log('');
    }

    const backContentCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'Back_Content/',
      Delimiter: '/',
      MaxKeys: 1000,
      RequestPayer: 'requester',
    });

    const backResponse = await client.send(backContentCommand);

    if (backResponse.CommonPrefixes && backResponse.CommonPrefixes.length > 0) {
      const batches = backResponse.CommonPrefixes.map((prefix) =>
        prefix.Prefix?.replace('Back_Content/', '').replace('/', ''),
      )
        .filter(Boolean)
        .sort();

      for (const batch of batches) {
        if (output) {
          folderNames.push(batch!);
        } else {
          console.log(`   ${chalk.green('📁')} ${chalk.cyan(batch)}`);
        }
      }
    } else {
      if (!output) {
        console.log(chalk.gray('   No historical batches found'));
      }
    }

    if (!output) {
      console.log('');
      console.log(chalk.blue('💡 Usage Examples:'));
      console.log(chalk.gray(`   List specific month:\t${server} list --month 2024-01`));
      console.log(chalk.gray(`   List specific batch:\t${server} list --batch Batch_01`));
      console.log(chalk.gray(`   List with limit:\t${server} list --month 2024-01 --limit 100`));
      console.log(
        chalk.gray(
          `   File listing (CSV):\t${server} list -m 2025-01 --limit 10000 -o 2025-01.csv`,
        ),
      );
      console.log(chalk.gray(`   Folder overview:\t${server} list -o folders.txt`));
      console.log('');
    } else {
      const textContent = folderNames.join('\n');
      await writeFile(output, textContent, 'utf-8');
      console.log(chalk.green(`✅ Exported ${folderNames.length} folders to ${output}`));
    }
  } catch (error) {
    if (error instanceof Error) {
      if (output) {
        throw new Error(`Failed to list folder structure: ${error.message}`);
      } else {
        console.log(
          chalk.yellow(`⚠️  Warning: Could not fetch content structure: ${error.message}`),
        );
        console.log(chalk.gray('   This may be due to AWS permissions or network issues'));
        console.log('');
      }
    } else {
      throw error;
    }
  }
}

export async function getContentInfo(
  path: string,
  options: { detailed?: boolean; server?: 'biorxiv' | 'medrxiv' } = {},
): Promise<void> {
  const client = await getS3Client();
  const { detailed = false, server = getDefaultServer() } = options;
  const bucketName = getBucketName(server);

  console.log(chalk.blue(`Getting info for: ${path}`));
  console.log(chalk.blue('=============================='));

  try {
    const commandOptions: any = {
      Bucket: bucketName,
      Key: path,
      RequestPayer: 'requester',
    };

    const command = new HeadObjectCommand(commandOptions);

    const response = await client.send(command);

    console.log(chalk.green('✓ Content found'));
    console.log('');
    console.log(`Key: ${chalk.cyan(path)}`);
    console.log(`Size: ${chalk.blue(formatFileSize(response.ContentLength || 0))}`);
    console.log(`Type: ${chalk.yellow(response.ContentType || 'Unknown')}`);
    console.log(
      `Last Modified: ${chalk.gray(response.LastModified?.toLocaleString() || 'Unknown')}`,
    );

    if (detailed && response.Metadata) {
      console.log('');
      console.log(chalk.blue('Metadata:'));
      for (const [key, value] of Object.entries(response.Metadata)) {
        console.log(`  ${key}: ${value}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get content info: ${error.message}`);
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
