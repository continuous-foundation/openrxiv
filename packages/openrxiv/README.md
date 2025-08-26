# openRxiv MECA Downloader CLI

A comprehensive command-line interface (CLI) tool to download, process, and manage openRxiv MECA (Manuscript Exchange Common Approach) files from AWS S3 for text and data mining purposes.

## Features

- **Multi-Server Support**: Works with both bioRxiv and medRxiv servers
- **AWS S3 Integration**: Connect to S3 buckets with requester-pays support
- **Content Exploration**: List, search, and browse available content by month or batch
- **Individual Downloads**: Download MECA files by DOI with API integration
- **Batch Processing**: Process large amounts of data with configurable concurrency
- **Content Summaries**: Get detailed information about preprints
- **Month/Batch Analysis**: Detailed metadata for specific time periods
- **XML Processing**: Robust handling of openRxiv XML files with entity replacement

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- AWS account with access to bioRxiv/medRxiv S3 buckets (`--requester-pays`)
- API key for bioRxiv API access

### Global Installation

```bash
npm install -g openrxiv
```

## Quick Start

### Summary

Get a summary of a bioRxiv/medRxiv preprint from a URL or DOI.

**Arguments:**

- `<url-or-doi>`: bioRxiv URL or DOI to summarize

**Options:**

- `-m, --more`: Show additional details and full abstract
- `-s, --server <server>`: Specify server (openrxiv or medrxiv)

**Examples:**

```bash
openrxiv summary "10.1101/2024.05.08.593085"
openrxiv summary -m "10.1101/2024.05.08.593085"
openrxiv summary -s medrxiv "10.1101/2020.03.19.20039131" --more
```

### Download Files

Download MECA files from the bioRxiv/medRxiv S3 buckets by DOI.

**Arguments:**

- `<doi>`: DOI of the paper (e.g., "10.1101/2024.05.08.593085")

**Options:**

- `-o, --output <dir>`: Output directory for downloaded files (default: "./downloads")
- `-a, --api-url <url>`: API base URL
- `--requester-pays`: Enable requester-pays for S3 bucket access

**Examples:**

```bash
openrxiv --requester-pays download "10.1101/2024.05.08.593085"
openrxiv --requester-pays download "10.1101/2024.05.08.593085" --output "./papers"
openrxiv --requester-pays download "10.1101/2024.05.08.593085" --api-url "https://custom-api.com"
```

### List Bucket Contents

List available content in the bioRxiv or medRxiv S3 bucket.

**Options:**

- `-m, --month <month>`: Filter by specific month (e.g., "2024-01" or "January_2024")
- `-b, --batch <batch>`: Filter by specific batch (e.g., "Batch_01")
- `-l, --limit <number>`: Limit the number of results (default: 50)
- `-s, --server <server>`: Server to use: "biorxiv" or "medrxiv"

**Examples:**

```bash
# Local development
openrxiv list
openrxiv list --month "2024-01"
openrxiv list --batch 1 --limit 100 --server medrxiv
```

## Batch Processing

List detailed metadata for all files in a specific month or batch.

**Options:**

- `-m, --month <month>`: Month to list (e.g., "January_2024" or "2024-01")
- `-b, --batch <batch>`: Batch to list (e.g., "1", "batch-1", "Batch_01")
- `-s, --server <server>`: Server to use: "biorxiv" or "medrxiv"

**Examples:**

```bash
openrxiv batch-info --month "2024-01"
openrxiv batch-info --batch "1"
openrxiv batch-info --server medrxiv --month "2024-01"
```

## Global Options

### `--requester-pays`

Enable requester pays functionality. The S3 buckets require requester pays for external access.

# Batch Processing

Batch process MECA files for a given month or batch.

**Options:**

**Time Selection:**

- `-m, --month <month>`: Month(s) to process. Supports: YYYY-MM, comma-separated list, or wildcard patterns
- `-b, --batch <batch>`: Batch to process. Supports: single batch, range, or comma-separated list

**Processing Control:**

- `-l, --limit <number>`: Maximum number of files to process
- `-c, --concurrency <number>`: Number of files to process concurrently (default: 1)
- `--force`: Force reprocessing of existing files
- `--dry-run`: List files without processing them

**Output Control:**

- `-o, --output <dir>`: Output directory for extracted files (default: "./batch-extracted")
- `--keep`: Keep MECA files after processing
- `--full-extract`: Extract entire MECA file instead of selective extraction
- `--max-file-size <size>`: Skip files larger than this size (e.g. 1GB)

**API Configuration:**

- `-a, --api-url <url>`: API base URL (default: "https://openrxiv.csf.now")
- `-k, --api-key <key>`: API key for authentication (or use OPENRXIV_BATCH_PROCESSING_API_KEY env var)
- `-s, --server <server>`: Server type: openrxiv or medrxiv

**Examples:**

```bash
# Process specific month
openrxiv batch-process --month "2025-08" --requester-pays

# Process multiple months
openrxiv batch-process --month "2024-01,2024-02,2024-03" --requester-pays

# Dry run to see what would be processed
openrxiv batch-process --month "2025-08" --dry-run

# Process all of 2025
openrxiv batch-process --month "2025-*" --requester-pays

# Process with concurrency
openrxiv batch-process --month "2025-08" --concurrency 5 --requester-pays
```

## Configuration

The tool reads AWS credentials from the home directory under the default profile, if available.

### Environment Variables

You can also set credentials via environment variables:

```bash
export OPENRXIV_BATCH_PROCESSING_API_KEY="your-api-key"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
```

## Development

### Local Development

```bash
git clone https://github.com/continuous-foundation/openrxiv
cd openrxiv
npm install
```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
npm run test:watch
```

### Linting & Formatting

```bash
npm run lint
npm run lint:format
```

## License

MIT License - see LICENSE file for details.

## Compliance

This tool is designed to comply with bioRxiv's and medRxiv's fair use policies:

- No content redistribution
- Link back to bioRxiv/medRxiv for indexing services
- Respect author copyright and licensing
- Intended for legitimate text and data mining purposes
