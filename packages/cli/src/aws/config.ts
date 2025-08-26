import { S3Client } from '@aws-sdk/client-s3';

const REGION = 'us-east-1';

// Global configuration for requester pays
let globalRequesterPays = false; // Default to false (no requester pays)

export function setGlobalRequesterPays(enabled: boolean): void {
  globalRequesterPays = enabled;
}

export function getGlobalRequesterPays(): boolean {
  return globalRequesterPays;
}

export async function getS3Client(): Promise<S3Client> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if ((accessKeyId || secretAccessKey) && !(accessKeyId && secretAccessKey)) {
    // Only one of the credentials is set, so we can't use them
    console.error(
      'AWS credentials are not set properly. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.',
    );
    process.exit(1);
  }
  return new S3Client({
    region: REGION,
    // AWS SDK will automatically use instance metadata service for credentials
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }
      : {}),
    requestHandler: {
      httpOptions: {
        timeout: 300000, // 5 minutes timeout for large operations
      },
    },
  });
}
