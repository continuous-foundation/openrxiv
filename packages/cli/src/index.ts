#!/usr/bin/env node

import { Command } from 'commander';
import { listCommand } from './commands/list.js';
import { downloadCommand } from './commands/download.js';
import { searchCommand } from './commands/search.js';
import { infoCommand } from './commands/info.js';
import { configCommand } from './commands/config.js';
import { summaryCommand } from './commands/summary.js';
import { monthInfoCommand } from './commands/month-info.js';
import { extractManifestCommand } from './commands/extract-manifest.js';
import { batchProcessCommand } from './commands/batch-process.js';
import version from './version.js';

const program = new Command();

program
  .name('biorxiv')
  .description('CLI tool to download bioRxiv MECA files from AWS S3 for text and data mining')
  .version(version);

// Add commands
program.addCommand(listCommand);
program.addCommand(downloadCommand);
program.addCommand(searchCommand);
program.addCommand(infoCommand);
program.addCommand(configCommand);
program.addCommand(summaryCommand);
program.addCommand(monthInfoCommand);
program.addCommand(extractManifestCommand);
program.addCommand(batchProcessCommand);

// Global options
program.option('-d, --debug', 'Enable debug mode');

// Parse command line arguments
program.parse();
