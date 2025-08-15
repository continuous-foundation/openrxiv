import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import chalk from 'chalk';
import { getS3Client, getGlobalRequesterPays } from './config.js';

export interface ListOptions {
  month?: string;
  batch?: string;
  limit?: number;
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
  const { month, batch, limit = 50 } = options;

  console.log(chalk.blue('Listing bioRxiv bucket content...'));
  console.log(chalk.blue('===================================='));

  try {
    let prefix = '';
    if (month) {
      prefix = `Current_Content/${month}/`;
    } else if (batch) {
      prefix = `Back_Content/${batch}/`;
    }

    const commandOptions: any = {
      Bucket: 'biorxiv-src-monthly',
      Prefix: prefix,
      MaxKeys: parseInt(limit.toString()),
    };

    // Only add RequestPayer if requester pays is enabled
    if (getGlobalRequesterPays()) {
      commandOptions.RequestPayer = 'requester';
    }

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

export async function searchContent(query: string, options: SearchOptions): Promise<void> {
  const client = await getS3Client();
  const { type = 'all', limit = 20 } = options;

  console.log(chalk.blue(`Searching for "${query}" in bioRxiv bucket...`));
  console.log(chalk.blue('=============================================='));

  try {
    // Search in both Current_Content and Back_Content
    const prefixes = ['Current_Content/', 'Back_Content/'];
    const results: ContentItem[] = [];

    for (const prefix of prefixes) {
      const commandOptions: any = {
        Bucket: 'biorxiv-src-monthly',
        Prefix: prefix,
        MaxKeys: 1000, // Get more items for searching
      };

      // Only add RequestPayer if requester pays is enabled
      if (getGlobalRequesterPays()) {
        commandOptions.RequestPayer = 'requester';
      }

      const command = new ListObjectsV2Command(commandOptions);

      const response = await client.send(command);

      if (response.Contents) {
        for (const item of response.Contents) {
          if (!item.Key) continue;

          if (item.Key.toLowerCase().includes(query.toLowerCase())) {
            const contentType = getContentType(item.Key);

            if (type === 'all' || contentType === type) {
              results.push({
                key: item.Key,
                size: item.Size || 0,
                lastModified: item.LastModified || new Date(),
                type: contentType,
              });
            }
          }
        }
      }
    }

    // Sort by last modified date (newest first)
    results.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    // Limit results
    const limitedResults = results.slice(0, parseInt(limit.toString()));

    if (limitedResults.length === 0) {
      console.log(chalk.yellow('No content found matching your search'));
      return;
    }

    console.log(chalk.green(`Found ${limitedResults.length} matching items:`));
    console.log('');

    for (const item of limitedResults) {
      const size = formatFileSize(item.size);
      const date = item.lastModified.toLocaleDateString();

      console.log(`${chalk.cyan(item.key)}`);
      console.log(
        `  Type: ${chalk.yellow(item.type)} | Size: ${chalk.blue(size)} | Modified: ${chalk.gray(date)}`,
      );
      console.log('');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Search failed: ${error.message}`);
    }
    throw error;
  }
}

export async function getContentInfo(path: string, options: { detailed?: boolean }): Promise<void> {
  const client = await getS3Client();
  const { detailed = false } = options;

  console.log(chalk.blue(`Getting info for: ${path}`));
  console.log(chalk.blue('=============================='));

  try {
    const commandOptions: any = {
      Bucket: 'biorxiv-src-monthly',
      Key: path,
    };

    // Only add RequestPayer if requester pays is enabled
    if (getGlobalRequesterPays()) {
      commandOptions.RequestPayer = 'requester';
    }

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
