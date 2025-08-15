import { Command } from 'commander';
import { downloadFile } from '../aws/downloader.js';

export const downloadCommand = new Command('download')
  .description('Download MECA files from the bioRxiv S3 bucket')
  .argument('<path>', 'S3 path to the MECA file (e.g., "Current_Content/January_2024/file.meca")')
  .option('-o, --output <dir>', 'Output directory for downloaded files', './downloads')
  .option('-p, --parallel <number>', 'Number of parallel downloads', '3')
  .option('--resume', 'Resume interrupted download if possible')
  .action(async (path, options) => {
    try {
      await downloadFile(path, options);
    } catch (error) {
      console.error('Error downloading file:', error);
      process.exit(1);
    }
  });
