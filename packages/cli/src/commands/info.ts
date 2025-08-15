import { Command } from 'commander';
import { getContentInfo } from '../aws/bucket-explorer.js';

export const infoCommand = new Command('info')
  .description('Show information about specific content in the bioRxiv S3 bucket')
  .argument('<path>', 'S3 path to the content')
  .option('--detailed', 'Show detailed information including metadata')
  .action(async (path, options) => {
    try {
      await getContentInfo(path, options);
    } catch (error) {
      console.error('Error getting content info:', error);
      process.exit(1);
    }
  });
