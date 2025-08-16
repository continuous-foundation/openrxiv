/**
 * Utility function to display the requester-pays error message
 * Used when S3 operations fail due to requester-pays bucket requirements
 */
export function displayRequesterPaysError(): void {
  console.error(`
❌ Operation failed: S3 bucket requires requester-pays
💡 This bucket has requester-pays enabled, which means:
   • You need to pay for data transfer costs
   • Your AWS credentials must be configured
   • The bucket policy must allow your account

🔧 To fix this:
   1. Ensure your AWS credentials are configured
   2. Verify you have permission to access the bucket
   3. Add the --requester-pays flag to your command

📚 For more help, see: https://docs.aws.amazon.com/AmazonS3/latest/userguide/RequesterPaysBuckets.html
`);
}
