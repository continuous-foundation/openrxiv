import { Command } from 'commander';
import {
  listCommand,
  downloadCommand,
  summaryCommand,
  monthInfoCommand,
  batchProcessCommand,
} from './commands/index.js';
import { getCliName } from './utils/index.js';
import { setGlobalRequesterPays } from './aws/config.js';
import version from './version.js';

export * from './commands/index.js';
export { default as version } from './version.js';
export { getCliName } from './utils/index.js';
export { setGlobalRequesterPays } from './aws/config.js';

export function createCLI(): Command {
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

  return program;
}
