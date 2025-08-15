import inquirer from 'inquirer';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const CONFIG_DIR = join(homedir(), '.biorxiv');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface ConfigData {
  aws: {
    accessKeyId?: string;
    secretAccessKey?: string;
    region: string;
    requesterPays?: boolean;
  };
}

// Global configuration for requester pays
let globalRequesterPays = false; // Default to false (no requester pays)

export function setGlobalRequesterPays(enabled: boolean): void {
  globalRequesterPays = enabled;
}

export function getGlobalRequesterPays(): boolean {
  return globalRequesterPays;
}

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

async function loadConfig(): Promise<ConfigData> {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = await readFile(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    // If config file is corrupted, start fresh
  }

  return {
    aws: {
      region: 'us-east-1',
    },
  };
}

async function saveConfig(config: ConfigData): Promise<void> {
  await ensureConfigDir();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export interface AWSCredentials {
  accessKey?: string;
  secretKey?: string;
  region?: string;
}

export async function setCredentials(options: AWSCredentials): Promise<void> {
  let { accessKey, secretKey, region } = options;

  // Prompt for missing credentials
  if (!accessKey) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'accessKey',
        message: 'Enter your AWS Access Key ID:',
        validate: (input) => (input.length > 0 ? true : 'Access Key is required'),
      },
    ]);
    accessKey = answer.accessKey;
  }

  if (!secretKey) {
    const answer = await inquirer.prompt([
      {
        type: 'password',
        name: 'secretKey',
        message: 'Enter your AWS Secret Access Key:',
        validate: (input) => (input.length > 0 ? true : 'Secret Key is required'),
      },
    ]);
    secretKey = answer.secretKey;
  }

  if (!region) {
    region = 'us-east-1';
  }

  // Save credentials
  const config = await loadConfig();
  config.aws.accessKeyId = accessKey;
  config.aws.secretAccessKey = secretKey;
  config.aws.region = region;

  await saveConfig(config);

  console.log(chalk.green('✓ AWS credentials saved successfully'));
  console.log(chalk.blue(`Region: ${region}`));
}

export async function testConnection(): Promise<void> {
  const credentials = await getCredentials();

  // If no credentials are provided, try to use instance metadata (EC2 IAM role)
  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    console.log(
      chalk.yellow(
        'No AWS credentials found in config, attempting to use EC2 instance metadata...',
      ),
    );
  }

  const client = new S3Client({
    region: credentials.region,
    ...(credentials.accessKeyId && credentials.secretAccessKey
      ? {
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
          },
        }
      : {}),
    requestHandler: {
      httpOptions: {
        timeout: 300000, // 5 minutes timeout for large operations
      },
    },
  });

  try {
    console.log(chalk.blue('Testing connection to bioRxiv bucket...'));

    // Test connection by listing a small amount of content
    const listCommandOptions: any = {
      Bucket: 'biorxiv-src-monthly',
      MaxKeys: 1,
    };

    // Only add RequestPayer if requester pays is enabled
    if (getGlobalRequesterPays()) {
      listCommandOptions.RequestPayer = 'requester';
    }

    const listCommand = new ListObjectsV2Command(listCommandOptions);

    await client.send(listCommand);

    console.log(chalk.green('✓ Successfully connected to bioRxiv bucket'));
    console.log(chalk.blue('Bucket: biorxiv-src-monthly'));
    console.log(chalk.blue('Region: us-east-1'));

    if (getGlobalRequesterPays()) {
      console.log(chalk.blue('Requester-pays: Enabled'));
      console.log(chalk.yellow('⚠️  You will be charged for S3 requests'));
    } else {
      console.log(chalk.blue('Requester-pays: Disabled'));
      console.log(
        chalk.green('✓ No charges for S3 requests (using EC2 IAM role or bucket owner pays)'),
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Access Denied') && !getGlobalRequesterPays()) {
        console.log(chalk.red('✗ Access denied. This bucket requires requester pays.'));
        console.log(chalk.yellow('Try running with --requester-pays flag for local development.'));
        console.log(chalk.blue('On EC2 with proper IAM role, this should work without the flag.'));
      } else {
        throw new Error(`Connection failed: ${error.message}`);
      }
    }
    throw error;
  }
}

export async function showConfig(): Promise<void> {
  const credentials = await getCredentials();

  console.log(chalk.blue('Current bioRxiv Configuration:'));
  console.log(chalk.blue('=============================='));

  if (credentials.accessKeyId) {
    console.log(chalk.green('✓ AWS Access Key: Configured'));
    console.log(chalk.blue(`Region: ${credentials.region}`));
  } else {
    console.log(chalk.red('✗ AWS credentials not configured'));
    console.log(chalk.yellow('Run "biorxiv config set-credentials" to configure'));
  }
}

export async function getCredentials() {
  const config = await loadConfig();
  return {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
    region: config.aws.region,
  };
}

export async function getS3Client(): Promise<S3Client> {
  const credentials = await getCredentials();

  // If no credentials are provided, try to use instance metadata (EC2 IAM role)
  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    console.log(
      chalk.yellow(
        'No AWS credentials found in config, attempting to use EC2 instance metadata...',
      ),
    );

    return new S3Client({
      region: credentials.region,
      // AWS SDK will automatically use instance metadata service for credentials
      requestHandler: {
        httpOptions: {
          timeout: 300000, // 5 minutes timeout for large operations
        },
      },
    });
  }

  return new S3Client({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    // bioRxiv bucket is requester-pays, so we need to configure the client accordingly
    requestHandler: {
      // This ensures the client can handle requester-pays operations
      httpOptions: {
        timeout: 300000, // 5 minutes timeout for large operations
      },
    },
  });
}
