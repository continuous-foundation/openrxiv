import { Command } from 'commander';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import chalk from 'chalk';
import { getS3Client } from '../aws/config.js';

export const extractManifestCommand = new Command('extract-manifest')
  .description('Extract manifest.xml from a MECA file without downloading the entire file')
  .argument('<s3-path>', 'S3 path to the MECA file (e.g., Current_Content/January_2025/file.meca)')
  .option('-o, --output <file>', 'Output file for manifest.xml (default: stdout)')
  .option('--pretty', 'Pretty print the XML output')
  .option('--json', 'Convert manifest.xml to JSON format')
  .action(async (s3Path, options) => {
    try {
      await extractManifestFromMECA(s3Path, options);
    } catch (error) {
      console.error('Error extracting manifest:', error);
      process.exit(1);
    }
  });

interface ExtractOptions {
  output?: string;
  pretty?: boolean;
  json?: boolean;
}

async function extractManifestFromMECA(s3Path: string, options: ExtractOptions): Promise<void> {
  const client = await getS3Client();

  console.log(chalk.blue(`🔍 Extracting manifest from: ${s3Path}`));
  console.log(chalk.blue('========================================'));
  console.log('');

  try {
    // Get file info first
    console.log(chalk.gray('📋 Getting file information...'));

    const getObjectCommand = new GetObjectCommand({
      Bucket: 'biorxiv-src-monthly',
      Key: s3Path,
      RequestPayer: 'requester',
    });

    const response = await client.send(getObjectCommand);

    if (!response.Body) {
      throw new Error('No file content received');
    }

    const fileSize = response.ContentLength || 0;
    console.log(chalk.green(`✅ File found: ${formatFileSize(fileSize)}`));
    console.log('');

    // Try partial download approach - ZIP files store central directory at the end
    console.log(chalk.gray('🔍 Attempting partial ZIP download...'));

    // Start with a reasonable chunk size and increase if needed
    let chunkSize = Math.min(1024 * 1024, fileSize); // 1MB or file size if smaller
    let manifestFound = false;
    let manifestContent = '';
    let manifestSize = 0;
    let totalDownloaded = 0;

    // Try downloading from the end of the file in chunks
    while (chunkSize <= fileSize && !manifestFound) {
      const startByte = Math.max(0, fileSize - chunkSize);
      const endByte = fileSize - 1;

      console.log(
        chalk.gray(
          `📥 Downloading bytes ${startByte}-${endByte} (${formatFileSize(chunkSize)})...`,
        ),
      );

      const rangeCommand = new GetObjectCommand({
        Bucket: 'biorxiv-src-monthly',
        Key: s3Path,
        Range: `bytes=${startByte}-${endByte}`,
        RequestPayer: 'requester',
      });

      try {
        const rangeResponse = await client.send(rangeCommand);

        if (!rangeResponse.Body) {
          throw new Error('No content received for range request');
        }

        // Collect the range data
        const chunks: Uint8Array[] = [];
        const stream = rangeResponse.Body as any;

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const rangeBuffer = Buffer.concat(chunks);
        totalDownloaded = rangeBuffer.length;

        console.log(chalk.gray(`📊 Downloaded: ${formatFileSize(totalDownloaded)}`));

        // Try to extract manifest from this range
        try {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(rangeBuffer);

          const manifestFile = zipContent.file('manifest.xml');
          if (manifestFile) {
            manifestContent = await manifestFile.async('string');
            manifestSize = manifestContent.length;
            manifestFound = true;

            console.log(chalk.green(`✅ Found manifest.xml in partial download!`));
            console.log(
              chalk.gray(
                `📊 Downloaded: ${formatFileSize(totalDownloaded)} of ${formatFileSize(fileSize)} (${((totalDownloaded / fileSize) * 100).toFixed(1)}%)`,
              ),
            );
            break;
          }
        } catch (error) {
          // ZIP is incomplete, continue with larger chunk
          console.log(chalk.gray(`⚠️  ZIP incomplete, trying larger chunk...`));
        }

        // If manifest not found, double the chunk size for next attempt
        chunkSize = Math.min(chunkSize * 2, fileSize);
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Range request failed, trying larger chunk...`));
        chunkSize = Math.min(chunkSize * 2, fileSize);
      }
    }

    if (!manifestFound) {
      // Fallback: download the complete file
      console.log(chalk.yellow('⚠️  Partial download failed, downloading complete file...'));

      const getObjectCommand = new GetObjectCommand({
        Bucket: 'biorxiv-src-monthly',
        Key: s3Path,
        RequestPayer: 'requester',
      });

      const fullResponse = await client.send(getObjectCommand);
      if (!fullResponse.Body) {
        throw new Error('No file content received');
      }

      const chunks: Uint8Array[] = [];
      const stream = fullResponse.Body as any;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const completeBuffer = Buffer.concat(chunks);
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(completeBuffer);

      const manifestFile = zipContent.file('manifest.xml');
      if (!manifestFile) {
        throw new Error('manifest.xml not found in MECA file');
      }

      manifestContent = await manifestFile.async('string');
      manifestSize = manifestContent.length;
      totalDownloaded = completeBuffer.length;

      console.log(chalk.yellow(`⚠️  Downloaded complete file: ${formatFileSize(totalDownloaded)}`));
    }

    console.log(chalk.green(`✅ Manifest size: ${formatFileSize(manifestSize)}`));
    console.log('');

    // Output the manifest
    if (options.json) {
      // Convert XML to JSON
      const jsonData = await convertManifestToJSON(manifestContent);
      const output = options.pretty ? JSON.stringify(jsonData, null, 2) : JSON.stringify(jsonData);

      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`💾 Manifest saved as JSON to: ${options.output}`));
      } else {
        console.log(chalk.blue('📄 Manifest as JSON:'));
        console.log(
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        );
        console.log(output);
      }
    } else {
      // Output as XML
      const output = options.pretty ? formatXML(manifestContent) : manifestContent;

      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`💾 Manifest saved to: ${options.output}`));
      } else {
        console.log(chalk.blue('📄 Manifest.xml content:'));
        console.log(
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        );
        console.log(output);
      }
    }

    // Show summary
    console.log('');
    console.log(
      chalk.blue(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ),
    );
    console.log(chalk.green('✅ Manifest extraction completed successfully!'));
    console.log(chalk.gray(`📁 Original file: ${s3Path}`));
    console.log(chalk.gray(`📊 Original size: ${formatFileSize(fileSize)}`));
    console.log(chalk.gray(`📄 Manifest size: ${formatFileSize(manifestSize)}`));
    console.log(chalk.gray(`💾 Data downloaded: ${formatFileSize(totalDownloaded)}`));

    if (totalDownloaded < fileSize) {
      const savings = (((fileSize - totalDownloaded) / fileSize) * 100).toFixed(1);
      console.log(chalk.green(`🎯 Efficiency: Downloaded ${savings}% less data than full file!`));
    }

    const downloadCost = (totalDownloaded / (1024 * 1024 * 1024)) * 0.09;
    const fullCost = (fileSize / (1024 * 1024 * 1024)) * 0.09;
    console.log(
      chalk.gray(
        `💰 Cost: $${downloadCost.toFixed(6)} (vs $${fullCost.toFixed(4)} for full download)`,
      ),
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract manifest: ${error.message}`);
    }
    throw error;
  }
}

async function convertManifestToJSON(xmlContent: string): Promise<any> {
  // Simple XML to JSON conversion for manifest.xml
  // This is a basic implementation - could be enhanced with a proper XML parser

  const json: any = {};

  // Extract basic fields using regex (simplified approach)
  const titleMatch = xmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) json.title = titleMatch[1].trim();

  const doiMatch = xmlContent.match(/<doi[^>]*>([^<]+)<\/doi>/i);
  if (doiMatch) json.doi = doiMatch[1].trim();

  const abstractMatch = xmlContent.match(/<abstract[^>]*>([^<]+)<\/abstract>/i);
  if (abstractMatch) json.abstract = abstractMatch[1].trim();

  // Extract authors
  const authorMatches = xmlContent.match(/<author[^>]*>([^<]+)<\/author>/gi);
  if (authorMatches) {
    json.authors = authorMatches
      .map((match) => {
        const authorMatch = match.match(/<author[^>]*>([^<]+)<\/author>/i);
        return authorMatch ? authorMatch[1].trim() : '';
      })
      .filter((author) => author);
  }

  // Extract submission date
  const dateMatch = xmlContent.match(/<submission-date[^>]*>([^<]+)<\/submission-date>/i);
  if (dateMatch) json.submissionDate = dateMatch[1].trim();

  // Extract version
  const versionMatch = xmlContent.match(/<version[^>]*>([^<]+)<\/version>/i);
  if (versionMatch) json.version = versionMatch[1].trim();

  // Extract category
  const categoryMatch = xmlContent.match(/<category[^>]*>([^<]+)<\/category>/i);
  if (categoryMatch) json.category = categoryMatch[1].trim();

  // Extract license
  const licenseMatch = xmlContent.match(/<license[^>]*>([^<]+)<\/license>/i);
  if (licenseMatch) json.license = licenseMatch[1].trim();

  return json;
}

function formatXML(xml: string): string {
  // Simple XML formatting (could be enhanced with a proper XML formatter)
  let formatted = xml;

  // Add line breaks after closing tags
  formatted = formatted.replace(/></g, '>\n<');

  // Add indentation
  const lines = formatted.split('\n');
  let indentLevel = 0;

  const formattedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('</')) {
      indentLevel--;
    }

    const indented = '  '.repeat(Math.max(0, indentLevel)) + trimmed;

    if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
      indentLevel++;
    }

    return indented;
  });

  return formattedLines.join('\n');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
