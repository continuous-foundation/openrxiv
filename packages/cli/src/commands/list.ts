import { Command } from 'commander';
import { listBucketContent } from '../aws/bucket-explorer.js';

export const listCommand = new Command('list')
  .description('List available content in the bioRxiv or medRxiv S3 bucket')
  .option('-m, --month <month>', 'Filter by specific month (e.g., "2024-01")')
  .option('-b, --batch <batch>', 'Filter by specific batch (e.g., "Batch_01")')
  .option('-l, --limit <number>', 'Limit the number of results', '50')
  .option('-s, --server <server>', 'Server to use: "biorxiv" or "medrxiv"', 'biorxiv')
  .action(async (options) => {
    try {
      await listBucketContent(options);
    } catch (error) {
      console.error('Error listing content:', error);
      process.exit(1);
    }
  });
