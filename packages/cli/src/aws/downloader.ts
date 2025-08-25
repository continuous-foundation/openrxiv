import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { getS3Client, getGlobalRequesterPays } from './config.js';
import { getDefaultServer } from '../utils/default-server.js';
import { getBucketName } from './bucket-explorer.js';

export interface DownloadOptions {
  output?: string;
  filename?: string;
  server?: 'biorxiv' | 'medrxiv';
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
}

export async function downloadFile(path: string, options: DownloadOptions): Promise<void> {
  const { output = './downloads', server = getDefaultServer() } = options;
  const bucket = getBucketName(server);
  const client = await getS3Client();

  console.log(chalk.blue(`Downloading: ${path}`));
  console.log(chalk.blue('=============================='));

  try {
    // Get file metadata
    const headCommandOptions: any = {
      Bucket: bucket,
      Key: path,
    };

    // Only add RequestPayer if requester pays is enabled
    if (getGlobalRequesterPays()) {
      headCommandOptions.RequestPayer = 'requester';
    }

    const headCommand = new HeadObjectCommand(headCommandOptions);

    const metadata = await client.send(headCommand);
    const fileSize = metadata.ContentLength || 0;
    const fileName = options.filename || path.split('/').pop() || 'unknown';
    const outputPath = join(output, fileName);

    // Create output directory
    await mkdir(dirname(outputPath), { recursive: true });

    // Start download
    const spinner = ora('Preparing download...').start();

    const getCommandOptions: any = {
      Bucket: bucket,
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
