import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3Client } from './config.js';
import { getFolderStructure } from 'openrxiv-utils';
import { getDefaultServer } from '../utils/default-server.js';
import { getBucketName } from './bucket-explorer.js';

export interface S3FileInfo {
  s3Bucket: string;
  s3Key: string;
  fileSize: number;
  lastModified: Date;
  batch: string;
}

export interface ListMonthOptions {
  month?: string; // Format: "YYYY-MM" (e.g., "2025-01")
  batch?: string; // Format: "Batch_01" for Back_Content
  server?: 'biorxiv' | 'medrxiv'; // Server type (default: 'biorxiv')
  limit?: number; // Max number of files to return
}

/**
 * Lists MECA files in S3 for a specific month with pagination support
 */
export async function listMonthFiles(options: ListMonthOptions): Promise<S3FileInfo[]> {
  const { month, batch, limit = 1000, server = getDefaultServer() } = options;
  const awsBucket = getBucketName(server);

  if (!month && !batch) {
    throw new Error('Either month or batch must be specified');
  }

  const description = month ? `month: ${month}` : `batch: ${batch}`;
  console.log(`🔍 Listing files for ${description} from AWS S3 bucket: ${awsBucket}`);

  try {
    const s3Client = await getS3Client();

    // Determine folder structure based on options
    const folder = getFolderStructure({ month, batch, server: options.server || 'biorxiv' });
    const s3Prefix = folder.prefix;

    console.log(
      `🔍 Content Type: ${folder.type === 'current' ? 'Current Content' : 'Back Content'}`,
    );
    if (folder.batch) {
      console.log(`🔍 Batch: ${folder.batch}`);
    }
    console.log(`🔍 Searching S3 prefix: ${s3Prefix}`);

    const allFiles: S3FileInfo[] = [];
    let continuationToken: string | undefined;
    let batchCount = 0;

    // Use pagination to get all files
    do {
      batchCount++;
      console.log(`📦 Fetching batch ${batchCount}...`);

      const listCommand = new ListObjectsV2Command({
        Bucket: awsBucket,
        Prefix: s3Prefix,
        MaxKeys: Math.min(1000, limit - allFiles.length), // Don't fetch more than we need
        ContinuationToken: continuationToken,
        RequestPayer: 'requester',
      });

      const response = await s3Client.send(listCommand);

      if (response.Contents) {
        for (const item of response.Contents) {
          if (!item.Key || !item.Size) continue;

          // Only process .meca files
          if (!item.Key.endsWith('.meca')) continue;

          // Extract S3 file information
          const s3Key = item.Key;
          const fileSize = item.Size;
          const lastModified = item.LastModified || new Date();

          const fileInfo: S3FileInfo = {
            s3Bucket: awsBucket,
            s3Key: s3Key, // This is already the full path from S3
            fileSize: fileSize,
            lastModified: lastModified,
            batch: folder.batch,
          };

          allFiles.push(fileInfo);

          // Check if we've reached the limit
          if (allFiles.length >= limit) {
            console.log(`📋 Reached limit of ${limit} files`);
            break;
          }
        }

        console.log(`   Found ${response.Contents.length} files in this batch`);
      }

      continuationToken = response.NextContinuationToken;

      // Break if we've reached the limit
      if (allFiles.length >= limit) {
        break;
      }
    } while (continuationToken);

    console.log(`📋 Found ${allFiles.length} MECA files in S3 bucket`);

    return allFiles;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error listing S3 files: ${error.message}`);

      if (error.message.includes('AWS credentials not configured')) {
        console.error('💡 Run "biorxiv config set-credentials" to configure AWS access');
      }
    } else {
      console.error('❌ Unknown error listing S3 files:', error);
    }
    return [];
  }
}
