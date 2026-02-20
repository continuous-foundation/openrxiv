# openRxiv MECA Downloader

A comprehensive command-line interface (CLI) tool and API server for downloading, processing, and managing openRxiv MECA (Manuscript Exchange Common Approach) files from AWS S3. This project bridges the gap between bioRxiv/medRxiv's S3 storage and researchers who need programmatic access to preprint data.

## 🎯 Why This Project Exists

### The Problem

bioRxiv and medRxiv provide MECA files in S3 buckets, but there's **no official API** to:

- Look up where a specific paper is stored in S3 given its DOI
- Download individual papers without traversing the entire bucket
- Access metadata without downloading the full MECA file (6-10MB vs 2-3KB for XML)

### The Solution

This project provides:

1. **CLI Tool** - Command-line access to bioRxiv/medRxiv data
2. **Metadata API** - DOI → S3 location lookups
3. **Batch Processing** - Efficient bulk data extraction and upload

## 🚀 Core Commands

### 1. **Summary** - Research Discovery

Get detailed information about preprints without downloading files.

```bash
# Basic paper information
openrxiv summary "10.1101/2024.05.08.593085"

# Full abstract and details
openrxiv summary -m "10.1101/2024.05.08.593085"

# Try medRxiv if not found on bioRxiv
openrxiv summary -s medrxiv "10.1101/2020.03.19.20039131"
```

### 2. **Download** - Individual Paper Access

Download specific MECA files by DOI using the metadata API.

```bash
# Download by DOI (requires API lookup)
openrxiv --requester-pays download "10.1101/2024.05.08.593085"

# Custom output directory
openrxiv --requester-pays download "10.1101/2024.05.08.593085" --output "./papers"
```

**Why it exists**: Researchers need individual papers, not entire months of data. The API integration means you can download a specific paper without knowing its S3 location.

### 3. **List** - Content Exploration

Explore what's available in the S3 buckets with intelligent filtering.

```bash
# See recent content
openrxiv list

# Filter by month
openrxiv list --month "2024-01"

# Filter by batch (for historical data)
openrxiv list --batch "Batch_01"

# Explore medRxiv content
openrxiv list --server medrxiv --limit 100

# Export file listing to CSV (key, size, date modified)
openrxiv list -m 2025-01 --limit 10000 -o 2025-01.csv

# Export folder overview to text file (all available months and batches)
openrxiv list --limit 10000 -o folders.txt
```

**Why it exists**: Researchers need to understand what data is available before planning downloads. This provides a window into the S3 bucket structure without full traversal. Use `-o` to export: CSV for file listings (with month/batch), or a text file for the folder overview.

## 🔌 API Endpoints

The project includes a lightweight API server that serves as the bridge between DOIs and S3 locations. A instance of the API server is at:

https://openrxiv.csf.now

### Core Endpoints

#### `GET /v1/works/{doiPrefix}/{doiSuffix}`

**Purpose**: Look up paper metadata and S3 location by DOI

**Example Response**:

```json
{
  "doi": "10.1101/2024.01.25.577295",
  "versions": [
    {
      "id": "cmedr9nx800i0ii04o4nk4bdy",
      "doi": "10.1101/2024.01.25.577295",
      "version": 1,
      "title": "Spyglass: a data analysis framework for reproducible and shareable neuroscience research",
      "receivedDate": "2024-01-25T00:00:00.000Z",
      "acceptedDate": "2024-01-26T00:00:00.000Z",
      "server": "biorxiv",
      "s3Bucket": "biorxiv-src-monthly",
      "s3Key": "Current_Content/January_2024/a765f23d-6f3e-1014-a187-cd164f93e87a.meca",
      "fileSize": 6147995,
      "links": {
        "self": "https://openrxiv.csf.now/v1/works/10.1101/2024.01.25.577295v1",
        "html": "https://www.biorxiv.org/content/10.1101/2024.01.25.577295v1.full",
        "pdf": "https://www.biorxiv.org/content/10.1101/2024.01.25.577295v1.full.pdf"
      }
    }
  ]
}
```

**Why this exists**: This maps preprint versions to S3 locations, enabling direct access to specific papers without bucket traversal.

#### `POST /v1/works`

**Purpose**: Upload paper metadata during batch processing

**Why this exists**: Batch processing extracts metadata from thousands of MECA files and needs to store it efficiently. This endpoint populates the database that powers the DOI lookups.

#### `DELETE /v1/works`

**Purpose**: Remove papers from the database

**Why this exists**: Papers can be updated, retracted, or moved. This endpoint maintains data integrity.

### Health & Status

- `GET /health` - API health check
- `GET /` - API information and available endpoints

## 🔄 How It All Works Together

### 1. **Data Flow**

```
S3 Buckets → CLI Batch Processing → API Database → CLI Commands
```

1. **S3 Buckets**: bioRxiv and medRxiv store MECA files in organized folders
2. **Batch Processing**: CLI downloads and processes MECA files, extracting metadata
3. **API Database**: Metadata is stored with S3 location information
4. **CLI Commands**: Use the API to look up papers and download them efficiently

### 2. **Use Case Examples**

#### Individual Researcher

```bash
# Discover a paper
openrxiv summary "10.1101/2024.05.08.593085"

# Download it for analysis
openrxiv --requester-pays download "10.1101/2024.05.08.593085"
```

#### Data Scientist

```bash
# See what's available this month
openrxiv list --month "2024-01" --limit 100

# Process all papers from January
openrxiv batch-process --month "2024-01" --concurrency 10
```

#### Research Team

```bash
# Explore historical data
openrxiv list --batch "1-53" --server medrxiv

# Batch process multiple months
openrxiv batch-process --month "2024-01,2024-02,2024-03" --concurrency 20
```

## 🏗️ Architecture

### CLI Tool (`packages/cli`)

- **Commands**: summary, download, list, batch-info, batch-process
- **AWS Integration**: S3 access with requester-pays support
- **API Client**: Integration with the metadata API
- **Processing**: MECA file extraction and XML parsing

### API Server (`apps/api`)

- **Database**: Prisma with PostgreSQL
- **Endpoints**: Work lookup, creation, and deletion
- **Authentication**: API key-based access control
- **Validation**: Comprehensive input validation

### Utilities (`packages/utils`)

- **DOI Parsing**: Handle bioRxiv's complex DOI format
- **Folder Structure**: Navigate S3 bucket organization
- **XML Processing**: Robust handling of bioRxiv XML files

## 📊 Data Scale

As of August 2025:

- **bioRxiv**: 398,744 individual works
- **medRxiv**: 88,358 individual works
- **Total**: ~487,000 papers across both servers

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- AWS credentials (for S3 access)
- API key for batch processing

### Installation

```bash
npm install -g openrxiv
```

## 🔧 Development

### Local Setup

```bash
git clone https://github.com/continuous-foundation/openrxiv
cd openrxiv
npm install
npm run build
```

### Available Scripts

- `npm run build` - Build all packages
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run changeset` - Manage versioning

## 📚 Documentation

- [CLI Reference](docs/cli-reference.md) - Complete command documentation
- [Batch Processing](docs/batch-processing.md) - Bulk data processing guide
- [DOI Structure](docs/biorxiv-doi.md) - Understanding bioRxiv DOIs
- [Processing Errors](docs/processing-errors.md) - Common issues and solutions
- [Download Locations](docs/download-locations.md) - S3 bucket organization

## 🤝 Contributing

This project is maintained by the [Continuous Science Foundation](https://github.com/continuous-foundation). We welcome contributions for:

- Bug fixes and improvements
- Additional CLI commands
- Enhanced API endpoints
- Documentation improvements

## 📄 License

MIT License - see LICENSE file for details.

## 🔒 Compliance

This tool is designed to comply with bioRxiv's and medRxiv's fair use policies:

- No content redistribution
- Proper attribution to original sources
- Intended for legitimate research and data mining purposes
- Respect for author copyright and licensing

---

**Why This Matters**: By providing efficient access to bioRxiv and medRxiv data, this project enables researchers to focus on science rather than data logistics. The combination of CLI tools and API endpoints creates a bridge between the raw S3 storage and the research community's needs.
