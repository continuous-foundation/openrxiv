---
title: Batch Processing
---

For batch processing,he `biorxiv` CLI should be run in batch mode in AWS in `us-east-1` region. The S3 bucket is requester-pays, and you will not be charged for the data transfer within the same AWS region, this means that you can traverse the bucket, download the content and extract the metadata in about two days on a `c6i-large` instance (\$0.085/hour, or less than \$5 total).

# Full Batch Processing

These commands will download the papers from the biorxiv and medrxiv servers, and extract the DOI, version, received/accepted date, and title from the JATS XML file. The result is uploaded to an API endpoint (`--api-url` and `--api-key`).

```
biorxiv batch-process --output ./downloads --requester-pays \
  --concurrency 20 \
  --batch "1-53" \
  --month "2019-*,2020-*,2021-*,2022-*,2023-*,2024-*,2025-*"
```

For medrxiv, we need to specify the server:

```
biorxiv batch-process --output ./downloads --requester-pays \
  --server medrxiv \
  --concurrency 20 \
  --batch "1-16" \
  --month "2020-*,2021-*,2022-*,2023-*,2024-*,2025-*"
```

The API requires a few endpoints to be implemented:

- `GET /api/v1/bucket/list?folder=...` - get all works in the folder
- `GET /api/v1/bucket?key=<s3key>` - get a single work by the S3 key
- `GET /api/v1/works/[DOI]` - get a single work by the DOI
- `POST /api/v1/works` - upload a single work

The bucket endpoint is used to list the contents of the bucket, and the work endpoint is used to get a single work by the DOI. The upload endpoint is used to upload a single work's metadata, which includes the DOI, version, received/accepted date, and title. If a work is already in the database, it will not be downloaded and parsed again.
