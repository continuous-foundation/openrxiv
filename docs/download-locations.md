---
title: openRxiv MECA API
---

# Overview

Both biorxiv and medrxiv provide a bucket with MECA files of all submitted content. The MECA files have a `[uuid].meca` format, and are in various folders arranged by Month (or in Batch, before ~2019). However, it is not possible to know the bucket location of a MECA file given a DOI. No official API is provided to do this by bioRxiv at this time.

The `biorxiv` CLI is a tool to download the MECA files from the bucket, and extract the metadata from the JATS XML file, upload it to a database, and provide a simple API to provide a direct lookup from the DOI and version to the S3 key. This is provided for bioRxiv and medRxiv.

As of August 2025, there are 398,744 individual works in bioRxiv and 88,358 in medRxiv.

# Metadata API

The API that is provided is at:

https://openrxiv.csf.now/v1/works/10.1101/2024.01.25.577295

A sample response is:

```json
// https://openrxiv.csf.now/v1/works/10.1101/2024.01.25.577295

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
      "batch": "January_2024",
      "s3Key": "Current_Content/January_2024/a765f23d-6f3e-1014-a187-cd164f93e87a.meca",
      "fileSize": 6147995,
      "links": {
        "self": "https://openrxiv.csf.now/v1/works/10.1101/2024.01.25.577295v1",
        "html": "https://www.biorxiv.org/content/10.1101/2024.01.25.577295v1.full",
        "abstract": "https://www.biorxiv.org/content/10.1101/2024.01.25.577295v1",
        "api": "https://api.biorxiv.org/details/biorxiv/10.1101/2024.01.25.577295/na/json",
        "pdf": "https://www.biorxiv.org/content/10.1101/2024.01.25.577295v1.full.pdf",
        "jats": "https://www.biorxiv.org/content/biorxiv/early/2024/01/26/2024.01.25.577295.source.xml"
      }
    },
    ... // Other versions
  ]
}
```

The `s3key` is the key to the MECA file in the `s3bucket`, which is the main utility of this API.

## Month Information

```bash
biorxiv batch-info --month 2025-08
biorxiv batch-info --server medrxiv --batch 6
```

```txt
📊 Summary Statistics
====================

📁 Content Structure:
   Type: Current Content
   Batch: August_2025

📁 File Types:
   OTHER: 1 (0.0%)
   MECA: 2730 (100.0%)

📦 MECA File Sizes:
   Total: 55.32 GB
   Average: 20.75 MB
   Range: 8.77 KB - 492.32 MB

📅 Upload Date Range:
   Earliest: 8/1/2025
   Latest: 8/17/2025

📊 Upload Date Distribution:
============================

  8/1/2025   58 │ █████████ (2.1%)
  8/2/2025  110 │ ████████████████ (4.0%)
  8/3/2025   78 │ ████████████ (2.9%)
  8/4/2025  293 │ ███████████████████████████████████████████ (10.7%)
  8/5/2025  337 │ ██████████████████████████████████████████████████ (12.3%)
  8/6/2025  191 │ ████████████████████████████ (7.0%)
  8/7/2025  241 │ ████████████████████████████████████ (8.8%)
  8/8/2025  139 │ █████████████████████ (5.1%)
  8/9/2025  194 │ █████████████████████████████ (7.1%)
 8/11/2025  198 │ █████████████████████████████ (7.3%)
 8/12/2025  220 │ █████████████████████████████████ (8.1%)
 8/13/2025  226 │ ██████████████████████████████████ (8.3%)
 8/14/2025  259 │ ██████████████████████████████████████ (9.5%)
 8/15/2025    1 │  (0.0%)
 8/16/2025  138 │ ████████████████████ (5.1%)
 8/17/2025   48 │ ███████ (1.8%)
```
