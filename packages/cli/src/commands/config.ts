import { Command } from 'commander';
import { setCredentials, testConnection, showConfig } from '../aws/config.js';

export const configCommand = new Command('config').description(
  'Manage AWS configuration and credentials',
);

configCommand
  .command('set-credentials')
  .description('Set AWS credentials for bioRxiv access')
  .option('--access-key <key>', 'AWS access key')
  .option('--secret-key <secret>', 'AWS secret key')
  .option('--region <region>', 'AWS region', 'us-east-1')
  .action(async (options) => {
    try {
      await setCredentials(options);
    } catch (error) {
      console.error('Error setting credentials:', error);
      process.exit(1);
    }
  });

configCommand
  .command('test')
  .description('Test AWS connection to bioRxiv bucket')
  .action(async () => {
    try {
      await testConnection();
    } catch (error) {
      console.error('Connection test failed:', error);
      process.exit(1);
    }
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    try {
      await showConfig();
    } catch (error) {
      console.error('Error showing config:', error);
      process.exit(1);
    }
  });
