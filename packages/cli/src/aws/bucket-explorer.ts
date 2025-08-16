import { ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import chalk from 'chalk';
import { getS3Client } from './config.js';
import { getContentStructure } from '../utils/content-structure.js';

/**
 * Get the S3 bucket name based on the server
 */
function getBucketName(server: string = 'biorxiv'): string {
  switch (server.toLowerCase()) {
    case 'medrxiv':
      return 'medrxiv-src-monthly';
    case 'biorxiv':
    default:
      return 'biorxiv-src-monthly';
  }
}

export interface ListOptions {
  month?: string;
  batch?: string;
  limit?: number;
  server?: string;
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
  const { month, batch, limit = 50, server = 'biorxiv' } = options;
  const bucketName = getBucketName(server);

  console.log(chalk.blue(`Listing ${server} bucket content...`));
  console.log(chalk.blue('===================================='));

  try {
    // If no month or batch specified, show the available content structure
    if (!month && !batch) {
      await listContentStructure(client, server);
      return;
    }

    let prefix = '';
    let contentStructure = null;

    if (month || batch) {
      // Use content structure utility to determine the correct prefix
      contentStructure = getContentStructure({ month, batch, server });
      prefix = contentStructure.prefix;

      console.log(
        chalk.gray(
          `🔍 Content Type: ${contentStructure.type === 'current' ? 'Current Content' : 'Back Content'}`,
        ),
      );
      if (contentStructure.batch) {
        console.log(chalk.gray(`🔍 Batch: ${contentStructure.batch}`));
      }
    }

    const commandOptions: any = {
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: parseInt(limit.toString()),
      RequestPayer: 'requester',
    };

    const command = new ListObjectsV2Command(commandOptions);

    const response = await client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      console.log(chalk.yellow('No content found'));
      return;
    }

    console.log(chalk.green(`Found ${response.Contents.length} items:`));
    console.log('');

    for (const item of response.Contents) {
      if (!item.Key) continue;

      const type = getContentType(item.Key);
      const size = formatFileSize(item.Size || 0);
      const date = item.LastModified ? item.LastModified.toLocaleDateString() : 'Unknown';

      console.log(`${chalk.cyan(item.Key)}`);
      console.log(
        `  Type: ${chalk.yellow(type)} | Size: ${chalk.blue(size)} | Modified: ${chalk.gray(date)}`,
      );
      console.log('');
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
async function listContentStructure(client: S3Client, server: string = 'biorxiv'): Promise<void> {
  console.log(chalk.cyan('📁 Available Content Structure'));
  console.log(chalk.cyan('=============================='));
  console.log('');

  try {
    // List Current_Content folders (monthly content)
    console.log(chalk.blue('📅 Current Content (Monthly):'));
    console.log(chalk.gray('   Recent content organized by month'));
    console.log('');

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
        console.log(`   ${chalk.green('📁')} ${chalk.cyan(month)}`);
      }
    } else {
      console.log(chalk.gray('   No monthly content found'));
    }

    console.log('');

    // List Back_Content batches
    console.log(chalk.blue('📦 Back Content (Historical Batches):'));
    console.log(chalk.gray('   Legacy content organized in batches'));
    console.log('');

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
        console.log(`   ${chalk.green('📁')} ${chalk.cyan(batch)}`);
      }
    } else {
      console.log(chalk.gray('   No historical batches found'));
    }

    console.log('');
    console.log(chalk.blue('💡 Usage Examples:'));
    console.log(chalk.gray(`   List specific month: ${server} list --month 2024-01`));
    console.log(chalk.gray(`   List specific batch: ${server} list --batch Batch_01`));
    console.log(chalk.gray(`   List with limit: ${server} list --month 2024-01 --limit 100`));
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.yellow(`⚠️  Warning: Could not fetch content structure: ${error.message}`));
      console.log(chalk.gray('   This may be due to AWS permissions or network issues'));
      console.log('');
    }
  }
}

export async function getContentInfo(
  path: string,
  options: { detailed?: boolean; server?: string } = {},
): Promise<void> {
  const client = await getS3Client();
  const { detailed = false, server = 'biorxiv' } = options;
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
