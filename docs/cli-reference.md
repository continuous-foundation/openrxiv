# bioRxiv CLI Commands Reference

This document provides a complete reference for all available commands in the bioRxiv CLI tool.

## Global Options

All commands support these global options:

| Option             | Short | Description                                                                          |
| ------------------ | ----- | ------------------------------------------------------------------------------------ |
| `--version`        | `-v`  | Print the current version of the bioRxiv CLI                                         |
| `--debug`          | `-d`  | Enable debug mode for verbose logging                                                |
| `--requester-pays` |       | Enable requester pays for local development (required when not on EC2 with IAM role) |
| `--help`           | `-h`  | Display help for command                                                             |

## Command Overview

| Command         | Description                          | Use Case                   |
| --------------- | ------------------------------------ | -------------------------- |
| `list`          | List available content in S3 buckets | Explore available data     |
| `download`      | Download MECA files by DOI           | Get specific papers        |
| `summary`       | Get preprint summaries               | Research and discovery     |
| `batch-info`    | Detailed metadata for time periods   | Data analysis and planning |
| `batch-process` | Process large amounts of data        | Bulk data processing       |

---

## 1. List Command (`list`)

Lists available content in the bioRxiv or medRxiv S3 bucket with filtering options.

### Usage

```bash
biorxiv list [options]
```

### Options

| Option     | Short | Description                                | Default |
| ---------- | ----- | ------------------------------------------ | ------- |
| `--month`  | `-m`  | Filter by specific month (e.g., "2024-01") |         |
| `--batch`  | `-b`  | Filter by specific batch (e.g., "1")       |         |
| `--limit`  | `-l`  | Limit the number of results                | 50      |
| `--server` | `-s`  | Server to use: "biorxiv" or "medrxiv"      | biorxiv |

### Examples

```bash
# List all available content (limited to 50)
biorxiv list

# List content for a specific month
biorxiv list --month "2024-01"

# List content for a specific batch
biorxiv list --batch "Batch_01"

# List content with custom limit
biorxiv list --limit 100

# List medRxiv content
biorxiv list --server medrxiv

# Local development with requester pays
biorxiv --requester-pays list --month "2024-01"
```

---

## 2. Download Command (`download`)

Downloads MECA files from the bioRxiv/medRxiv S3 bucket by DOI.

### Usage

```bash
biorxiv download [options] <doi>
```

### Arguments

| Argument | Description      | Example                     |
| -------- | ---------------- | --------------------------- |
| `doi`    | DOI of the paper | "10.1101/2024.01.15.123456" |

### Options

| Option             | Short | Description                                | Default                    |
| ------------------ | ----- | ------------------------------------------ | -------------------------- |
| `--output`         | `-o`  | Output directory for downloaded files      | "./downloads"              |
| `--api-url`        | `-a`  | API base URL                               | "https://openrxiv.csf.now" |
| `--requester-pays` |       | Enable requester-pays for S3 bucket access | false                      |

### Examples

```bash
# Download a paper by DOI
biorxiv download 10.1101/2024.01.15.123456

# Download to custom directory
biorxiv download -o ./papers 10.1101/2024.01.15.123456

# Download with custom API
biorxiv download -a https://custom-api.com 10.1101/2024.01.15.123456

# Local development with requester pays
biorxiv --requester-pays download 10.1101/2024.01.15.123456
```

---

## 3. Summary Command (`summary`)

Gets a summary of a bioRxiv/medRxiv preprint from a URL or DOI.

### Usage

```bash
biorxiv summary [options] <url-or-doi>
```

### Arguments

| Argument     | Description                     | Example                     |
| ------------ | ------------------------------- | --------------------------- |
| `url-or-doi` | bioRxiv URL or DOI to summarize | "10.1101/2024.01.15.123456" |

### Options

| Option     | Short | Description                               | Default |
| ---------- | ----- | ----------------------------------------- | ------- |
| `--more`   | `-m`  | Show additional details and full abstract | false   |
| `--server` | `-s`  | Specify server (biorxiv or medrxiv)       | biorxiv |

### Examples

```bash
# Get basic summary
biorxiv summary 10.1101/2024.01.15.123456

# Get detailed summary with full abstract
biorxiv summary -m 10.1101/2024.01.15.123456

# Get summary from medRxiv
biorxiv summary -s medrxiv 10.1101/2024.01.15.123456

# Get summary from bioRxiv URL
biorxiv summary "https://biorxiv.org/content/10.1101/2024.01.15.123456"
```

---

## 4. Batch Info Command (`batch-info`)

Lists detailed metadata for all files in a specific month or batch from bioRxiv or medRxiv.

### Usage

```bash
biorxiv batch-info [options]
```

### Options

| Option     | Short | Description                                       | Required     |
| ---------- | ----- | ------------------------------------------------- | ------------ |
| `--month`  | `-m`  | Month to list (e.g., "January_2024" or "2024-01") | One of these |
| `--batch`  | `-b`  | Batch to list (e.g., "1", "batch-1", "Batch_01")  | One of these |
| `--server` | `-s`  | Server to use: "biorxiv" or "medrxiv"             | biorxiv      |

### Examples

```bash
# List files for a specific month
biorxiv batch-info --month "2024-01"

# List files for a specific batch
biorxiv batch-info --batch "1"

# List medRxiv month info
biorxiv batch-info --server medrxiv --month "2024-01"

# Local development with requester pays
biorxiv --requester-pays batch-info --month "2024-01"
```

## 5. Batch Process Command (`batch-process`)

Batch processes MECA files for a given month or batch. This is the most powerful command for processing large amounts of data.

### Usage

```bash
biorxiv batch-process [options]
```

### Options

#### Time Selection

| Option    | Short | Description                                                                                                                                                                        | Required     |
| --------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--month` | `-m`  | Month(s) to process. Supports: YYYY-MM, comma-separated list (2025-01,2025-02), or wildcard pattern (2025-\*). If not specified, processes backwards from current month to 2018-12 | One of these |
| `--batch` | `-b`  | Batch to process. Supports: single batch (e.g., "1"), range (e.g., "1-10"), or comma-separated list (e.g., "1,2,3"). Use this for historical content before 2018-12.               | One of these |

#### Processing Control

| Option          | Short | Description                                                                         | Default |
| --------------- | ----- | ----------------------------------------------------------------------------------- | ------- |
| `--limit`       | `-l`  | Maximum number of files to process. If not specified, processes all available files |         |
| `--concurrency` | `-c`  | Number of files to process concurrently                                             | 1       |
| `--force`       |       | Force reprocessing of existing files                                                | false   |
| `--dry-run`     |       | List files without processing them                                                  | false   |

#### Output Control

| Option            | Short | Description                                              | Default             |
| ----------------- | ----- | -------------------------------------------------------- | ------------------- |
| `--output`        | `-o`  | Output directory for extracted files                     | "./batch-extracted" |
| `--keep`          |       | Keep MECA files after processing                         | false               |
| `--full-extract`  |       | Extract entire MECA file instead of selective extraction | false               |
| `--max-file-size` |       | Skip files larger than this size (e.g., 100MB, 2GB)      |                     |

#### API Configuration

| Option      | Short | Description                                                                   | Default                    |
| ----------- | ----- | ----------------------------------------------------------------------------- | -------------------------- |
| `--api-url` | `-a`  | API base URL                                                                  | "https://openrxiv.csf.now" |
| `--api-key` | `-k`  | API key for authentication (or use OPENRXIV_BATCH_PROCESSING_API_KEY env var) |                            |
| `--server`  | `-s`  | Server type: biorxiv or medrxiv                                               | biorxiv                    |

### Examples

#### Basic Usage

```bash
# Process current month
biorxiv batch-process

# Process specific month
biorxiv batch-process --month "2024-01"

# Process multiple months
biorxiv batch-process --month "2024-01,2024-02,2024-03"

# Process with wildcard
biorxiv batch-process --month "2024-*"
```

#### Advanced Processing

```bash
# Dry run to see what would be processed
biorxiv batch-process --month "2024-01" --dry-run

# Process with concurrency
biorxiv batch-process --month "2024-01" --concurrency 5

# Force reprocessing
biorxiv batch-process --month "2024-01" --force

# Limit number of files
biorxiv batch-process --month "2024-01" --limit 100
```

#### Custom Configuration

```bash
# Custom output directory
biorxiv batch-process --month "2024-01" --output ./custom-output

# Custom API endpoint
biorxiv batch-process --month "2024-01" --api-url https://custom-api.com

# Process medRxiv
biorxiv batch-process --month "2024-01" --server medrxiv

# Local development with requester pays
biorxiv --requester-pays batch-process --month "2024-01"
```

## Environment Variables

The CLI supports several environment variables for configuration:

| Variable                            | Description                |
| ----------------------------------- | -------------------------- |
| `OPENRXIV_BATCH_PROCESSING_API_KEY` | API key for authentication |
| `AWS_ACCESS_KEY_ID`                 | AWS access key             |
| `AWS_SECRET_ACCESS_KEY`             | AWS secret key             |

---

## Best Practices

### 1. **Start with Dry Runs**

Always use `--dry-run` first to understand what will be processed:

```bash
biorxiv batch-process --month "2024-01" --dry-run
```

### 2. **Use Appropriate Concurrency**

Balance between speed and resource usage:

```bash
# For development/testing
biorxiv batch-process --concurrency 1

# For production with good bandwidth
biorxiv batch-process --concurrency 10
```

### 3. **Monitor Resource Usage**

- Watch CPU usage during processing
- Monitor network bandwidth
- Check disk space for output files

### 4. **Handle Large Datasets**

Use limits and batch processing for large datasets:

```bash
# Process in chunks
biorxiv batch-process --month "2024-01" --limit 1000
biorxiv batch-process --month "2024-02" --limit 1000
```

## Integration Notes

- The CLI handles common XML parsing issues in bioRxiv files
- Supports both bioRxiv and medRxiv servers
- Integrates with the bioRxiv API for DOI-based lookups
- Designed to work with AWS Lambda for automated processing
- Includes comprehensive error handling and progress tracking
