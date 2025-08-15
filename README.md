# bioRxiv MECA Downloader CLI

A command-line interface (CLI) tool to download bioRxiv MECA (Manuscript Exchange Common Approach) files from AWS S3 for text and data mining purposes.

## Features

- **AWS S3 Integration**: Connect to the bioRxiv S3 bucket with requester-pays support
- **Content Exploration**: List, search, and browse available content by month or batch
- **Download Management**: Download individual MECA files with progress tracking
- **Parallel Downloads**: Support for multiple concurrent downloads
- **Resume Capability**: Resume interrupted downloads when possible
- **Secure Credentials**: Secure storage of AWS credentials
- **Progress Tracking**: Real-time download progress with speed and ETA

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- AWS account with access to the bioRxiv S3 bucket

### Global Installation

```bash
npm install -g biorxiv
```

### Local Development

```bash
git clone <repository-url>
cd biorxiv-meca-downloader
npm install
npm run build
```

## Quick Start

### 1. Configure AWS Credentials

```bash
biorxiv config set-credentials
```

You'll be prompted to enter:

- AWS Access Key ID
- AWS Secret Access Key
- AWS Region (defaults to us-east-1)

### 2. Test Connection

```bash
biorxiv config test
```

### 3. Explore Content

```bash
# List available content
biorxiv list

# List content for a specific month
biorxiv list --month "January_2024"

# List content for a specific batch
biorxiv list --batch "Batch_01"
```

### 4. Download Files

```bash
# Download a specific MECA file
biorxiv download "Current_Content/January_2024/file.meca"

# Download with custom output directory
biorxiv download "Current_Content/January_2024/file.meca" --output "./my-downloads"

# Download with parallel processing
biorxiv download "Current_Content/January_2024/file.meca" --parallel 5
```

## Commands

### `biorxiv list`

List available content in the bioRxiv S3 bucket.

**Options:**

- `-m, --month <month>`: Filter by specific month (e.g., "2024-01" or "January_2024")
- `-b, --batch <batch>`: Filter by specific batch (e.g., "Batch_01")
- `-l, --limit <number>`: Limit the number of results (default: 50)

**Examples:**

```bash
biorxiv list
biorxiv list --month "2024-01"
biorxiv list --batch "Batch_01" --limit 100
```

### `biorxiv download`

Download MECA files from the bioRxiv S3 bucket.

**Arguments:**

- `<path>`: S3 path to the MECA file

**Options:**

- `-o, --output <dir>`: Output directory for downloaded files (default: "./downloads")
- `-p, --parallel <number>`: Number of parallel downloads (default: 3)
- `--resume`: Resume interrupted download if possible

**Examples:**

```bash
biorxiv download "Current_Content/January_2024/file.meca"
biorxiv download "Back_Content/Batch_01/file.meca" --output "./backup"
biorxiv download "Current_Content/January_2024/file.meca" --parallel 5 --resume
```

### `biorxiv search`

Search for content in the bioRxiv S3 bucket.

**Arguments:**

- `<query>`: Search query

**Options:**

- `-t, --type <type>`: Filter by content type (pdf, xml, all) (default: "all")
- `-l, --limit <number>`: Limit the number of results (default: 20)

**Examples:**

```bash
biorxiv search "cancer"
biorxiv search "neural" --type pdf
biorxiv search "genomics" --limit 50
```

### `biorxiv info`

Show information about specific content in the bioRxiv S3 bucket.

**Arguments:**

- `<path>`: S3 path to the content

**Options:**

- `--detailed`: Show detailed information including metadata

**Examples:**

```bash
biorxiv info "Current_Content/January_2024/file.meca"
biorxiv info "Back_Content/Batch_01/file.meca" --detailed
```

### `biorxiv config`

Manage AWS configuration and credentials.

**Subcommands:**

- `set-credentials`: Set AWS credentials for bioRxiv access
- `test`: Test AWS connection to bioRxiv bucket
- `show`: Show current configuration

**Examples:**

```bash
biorxiv config set-credentials
biorxiv config test
biorxiv config show
```

## Configuration

The tool stores configuration in a local configuration file. Credentials are stored securely and are not shared or transmitted.

### Environment Variables

You can also set credentials via environment variables:

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

## AWS S3 Bucket Details

- **Bucket**: `biorxiv-src-monthly`
- **Region**: us-east-1 (N. Virginia)
- **Requester Pays**: Enabled (users pay for data transfer)
- **Content Structure**:
  - `Back_Content/Batch_[nn]/` - Historical batches
  - `Current_Content/[Month]_[Year]/` - Monthly updates

### Cost Considerations

- Data transfer costs: ~$0.09 per GB (us-east-1)
- Request costs: ~$0.0004 per 1,000 requests
- Storage costs: Not applicable (read-only access)

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
npm run test:watch
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Formatting

```bash
npm run lint:format
```

## Project Structure

```
src/
├── cli/                    # CLI command implementations
├── aws/                    # AWS S3 integration
├── utils/                  # Utility functions
└── index.ts               # Main CLI entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Compliance

This tool is designed to comply with bioRxiv's fair use policies:

- No content redistribution
- Link back to bioRxiv for indexing services
- Respect author copyright and licensing
- Intended for legitimate text and data mining purposes

## Support

For issues and questions:

1. Check the [documentation](https://github.com/yourusername/biorxiv-meca-downloader)
2. Search existing [issues](https://github.com/yourusername/biorxiv-meca-downloader/issues)
3. Create a new issue with detailed information

## Changelog

### v0.0.0

- Initial release
- Basic CLI functionality
- AWS S3 integration
- Content listing and downloading
- Progress tracking
