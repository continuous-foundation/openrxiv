import { Command } from 'commander';
import { searchContent } from '../aws/bucket-explorer.js';

export const searchCommand = new Command('search')
  .description('Search for content in the bioRxiv S3 bucket')
  .argument('<query>', 'Search query')
  .option('-t, --type <type>', 'Filter by content type (pdf, xml, all)', 'all')
  .option('-l, --limit <number>', 'Limit the number of results', '20')
  .action(async (query, options) => {
    try {
      await searchContent(query, options);
    } catch (error) {
      console.error('Error searching content:', error);
      process.exit(1);
    }
  });
