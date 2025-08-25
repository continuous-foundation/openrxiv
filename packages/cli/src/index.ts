#!/usr/bin/env node

import { Command } from 'commander';
import { listCommand } from './commands/list.js';
import { downloadCommand } from './commands/download.js';
import { configCommand } from './commands/config.js';
import { summaryCommand } from './commands/summary.js';
import { monthInfoCommand } from './commands/month-info.js';
import { batchProcessCommand } from './commands/batch-process.js';
import { setGlobalRequesterPays } from './aws/config.js';
import version from './version.js';
import { getCliName } from './utils/index.js';

const cliName = getCliName();

const program = new Command();

program
  .name(cliName)
  .description(
    `CLI tool to download bioRxiv/medRxiv MECA files from AWS S3 for text and data mining`,
  )
  .version(`v${version}`, '-v, --version', `Print the current version of the ${cliName} CLI`);

// Add commands
program.addCommand(listCommand);
program.addCommand(downloadCommand);
program.addCommand(configCommand);
program.addCommand(summaryCommand);
program.addCommand(monthInfoCommand);
program.addCommand(batchProcessCommand);

// Global options
program.option('-d, --debug', 'Enable debug mode');
program.option(
  '--requester-pays',
  'Enable requester pays for local development (required when not on EC2 with IAM role)',
);

// Parse command line arguments
program.parse();

// Set global requester pays based on command line option
const options = program.opts();
if (options.requesterPays) {
  setGlobalRequesterPays(true);
  console.log('Requester pays enabled - you will be charged for S3 requests');
}
