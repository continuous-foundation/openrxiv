import { Command, Option } from 'commander';
import axios from 'axios';
import { downloadFile } from '../aws/downloader.js';
import { setGlobalRequesterPays } from '../aws/config.js';

export const downloadCommand = new Command('download')
  .description('Download MECA files from the bioRxiv S3 bucket by DOI')
  .argument('<doi>', 'DOI of the paper (e.g., "10.1101/2024.01.15.123456")')
  .option('-o, --output <dir>', 'Output directory for downloaded files', './downloads')
  .option('-p, --parallel <number>', 'Number of parallel downloads', '3')
  .option('--resume', 'Resume interrupted download if possible')
  .option('-a, --api-url <url>', 'API base URL', 'https://biorxiv.curvenote.dev')
  .option('--requester-pays', 'Enable requester-pays for S3 bucket access')
  .addOption(
    new Option(
      '-k, --api-key <key>',
      'API key for authentication (or use BIORXIV_API_KEY env var)',
    ).env('BIORXIV_API_KEY'),
  )
  .action(async (doi, options) => {
    try {
      // Validate DOI format
      if (!doi.includes('/')) {
        console.error('❌ Invalid DOI format. Expected format: 10.1101/2024.01.15.123456');
        process.exit(1);
      }

      // Split DOI into prefix and suffix
      const [doiPrefix, doiSuffix] = doi.split('/', 2);

      console.log(`🔍 Looking up paper with DOI: ${doi}`);
      console.log(`📡 API URL: ${options.apiUrl}`);

      // Look up the paper in the API
      const response = await axios.get(`${options.apiUrl}/v1/works/${doiPrefix}/${doiSuffix}`);

      if (!response.data || !response.data.s3Key) {
        console.error('❌ Paper not found or no S3 key available');
        process.exit(1);
      }

      const paper = response.data;
      console.log(`📄 Found paper: ${paper.title || 'Unknown title'}`);
      console.log(`📦 S3 Key: ${paper.s3Key}`);

      // Set requester-pays if flag is provided
      if (options.requesterPays) {
        setGlobalRequesterPays(true);
        console.log(`💰 Requester-pays enabled for S3 access`);
      }

      // Create a filesystem-safe filename from the DOI
      const safeDoi = doi.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${safeDoi}.meca`;

      console.log(`📥 Downloading MECA file as: ${filename}`);

      // Download the file using the S3 key from the API
      try {
        await downloadFile(paper.s3Key, { ...options, filename });
        console.log(`✅ Successfully downloaded MECA file for DOI: ${doi}`);
      } catch (downloadError) {
        // Check if it's a requester-pays related error
        const errorMessage =
          downloadError instanceof Error ? downloadError.message : String(downloadError);

        if (errorMessage.includes('UnknownError') || errorMessage.includes('AccessDenied')) {
          console.error('❌ Download failed: S3 bucket requires requester-pays');
          console.error('💡 This bucket has requester-pays enabled, which means:');
          console.error('   • You need to pay for data transfer costs');
          console.error('   • Your AWS credentials must be configured');
          console.error('   • The bucket policy must allow your account');
          console.error('');
          console.error('🔧 To fix this:');
          console.error('   1. Ensure your AWS credentials are configured');
          console.error('   2. Verify you have permission to access the bucket');
          console.error('   3. Add the --requester-pays flag to your command');
          console.error('');
          console.error(
            '📚 For more help, see: https://docs.aws.amazon.com/AmazonS3/latest/userguide/RequesterPaysBuckets.html',
          );
        } else {
          console.error('❌ Download failed:', errorMessage);
        }
        process.exit(1);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.error('❌ Paper not found with the specified DOI');
        } else if (error.response?.status === 401) {
          console.error('❌ Authentication failed. Please check your API key');
        } else {
          console.error('❌ API error:', error.response?.data || error.message);
        }
      } else {
        console.error('❌ Error looking up paper:', error);
      }
      process.exit(1);
    }
  });
