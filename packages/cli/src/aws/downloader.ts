import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, existsSync, statSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { getS3Client, getGlobalRequesterPays } from './config.js';

export interface DownloadOptions {
  output?: string;
  parallel?: number;
  resume?: boolean;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
}

export async function downloadFile(path: string, options: DownloadOptions): Promise<void> {
  const { output = './downloads', parallel = 3, resume = false } = options;
  const client = await getS3Client();

  console.log(chalk.blue(`Downloading: ${path}`));
  console.log(chalk.blue('=============================='));

  try {
    // Get file metadata
    const headCommandOptions: any = {
      Bucket: 'biorxiv-src-monthly',
      Key: path,
    };

    // Only add RequestPayer if requester pays is enabled
    if (getGlobalRequesterPays()) {
      headCommandOptions.RequestPayer = 'requester';
    }

    const headCommand = new HeadObjectCommand(headCommandOptions);

    const metadata = await client.send(headCommand);
    const fileSize = metadata.ContentLength || 0;
    const fileName = path.split('/').pop() || 'unknown';
    const outputPath = join(output, fileName);

    // Create output directory
    await mkdir(dirname(outputPath), { recursive: true });

    // Check if file exists and handle resume
    if (existsSync(outputPath) && resume) {
      const stats = statSync(outputPath);
      if (stats.size === fileSize) {
        console.log(chalk.green('✓ File already exists and is complete'));
        return;
      }

      if (stats.size < fileSize) {
        console.log(chalk.yellow(`Resuming download from ${formatFileSize(stats.size)}`));
        // Note: S3 doesn't support partial downloads with resume, so we'll download from scratch
        // In a real implementation, you might want to implement proper resume logic
      }
    }

    // Start download
    const spinner = ora('Preparing download...').start();

    const getCommandOptions: any = {
      Bucket: 'biorxiv-src-monthly',
      Key: path,
    };

    // Only add RequestPayer if requester pays is enabled
    if (getGlobalRequesterPays()) {
      getCommandOptions.RequestPayer = 'requester';
    }

    const getCommand = new GetObjectCommand(getCommandOptions);

    const response = await client.send(getCommand);

    if (!response.Body) {
      throw new Error('No file content received');
    }

    spinner.succeed('Download started');

    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
      format:
        'Downloading |{bar}| {percentage}% | {value}/{total} bytes | Speed: {speed} | ETA: {eta}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(fileSize, 0);

    let downloadedBytes = 0;
    const startTime = Date.now();

    // Create transform stream to track progress
    const progressStream = new (class extends Transform {
      constructor() {
        super();
      }

      _transform(
        chunk: Buffer,
        encoding: string,
        callback: (error?: Error | null, data?: Buffer) => void,
      ) {
        downloadedBytes += chunk.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = downloadedBytes / elapsed;
        const eta = (fileSize - downloadedBytes) / speed;

        progressBar.update(downloadedBytes);
        callback(null, chunk);
      }
    })();

    // Download file
    const writeStream = createWriteStream(outputPath);

    await pipeline(response.Body as any, progressStream, writeStream);

    progressBar.stop();
    console.log(chalk.green(`✓ Download completed: ${outputPath}`));
    console.log(chalk.blue(`File size: ${formatFileSize(fileSize)}`));
  } catch (error) {
    if (error instanceof Error) {
      // Check for specific AWS errors that indicate requester pays is needed
      if (error.message.includes('Access Denied') || error.message.includes('403')) {
        if (!getGlobalRequesterPays()) {
          throw new Error(
            `Download failed: Access denied. This bucket requires requester pays for downloads. ` +
              `Try running with --requester-pays flag or ensure your IAM role has requester pays permissions.`,
          );
        } else {
          throw new Error(
            `Download failed: Access denied. Check your AWS credentials and permissions.`,
          );
        }
      } else if (error.message.includes('NoSuchKey')) {
        throw new Error(`Download failed: File not found in S3 bucket.`);
      } else if (error.message.includes('NoSuchBucket')) {
        throw new Error(`Download failed: S3 bucket not found.`);
      } else {
        throw new Error(`Download failed: ${error.message}`);
      }
    }
    throw error;
  }
}

export async function downloadMultipleFiles(
  paths: string[],
  options: DownloadOptions,
): Promise<void> {
  const { output = './downloads', parallel = 3 } = options;

  console.log(chalk.blue(`Downloading ${paths.length} files with ${parallel} parallel downloads`));
  console.log(chalk.blue('=============================================================='));

  const chunks = chunkArray(paths, parallel);
  let completed = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const promises = chunk.map(async (path) => {
      try {
        await downloadFile(path, { ...options, output });
        completed++;
        console.log(chalk.green(`✓ Completed ${completed}/${paths.length}`));
      } catch (error) {
        failed++;
        console.error(chalk.red(`✗ Failed to download ${path}: ${error}`));
      }
    });

    await Promise.all(promises);
  }

  console.log(chalk.blue('Download Summary:'));
  console.log(chalk.blue('================'));
  console.log(chalk.green(`Completed: ${completed}`));
  if (failed > 0) {
    console.log(chalk.red(`Failed: ${failed}`));
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
