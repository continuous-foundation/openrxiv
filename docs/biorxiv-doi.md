---
title: bioRxiv DOIs
---

bioRxiv uses Digital Object Identifiers (DOIs) to uniquely identify preprints. These DOIs provide persistent links to papers and are essential for citation, linking, and data management. Versioning of those papers is handled by bioRxiv and individual versions do not have their own DOIs.

## DOI Structure

All bioRxiv DOIs follow the pattern:

```
10.1101/XXXXXX
```

Where:

- **`10.1101`** is the constant prefix assigned to bioRxiv
- **`XXXXXX`** is the unique identifier that varies by format

## DOI Formats

bioRxiv uses **two different DOI formats** depending on when the paper was submitted:

### 1. Legacy Format (2019 and earlier)

**Pattern:** `10.1101/XXXXXX` where `XXXXXX` is a 6-digit number (medRxiv uses 8 digits)

**Examples:**

- `10.1101/486050` - A paper from 2019 or earlier
- `10.1101/123456` - Another legacy paper
- `10.1101/789012` - Another legacy paper

**Characteristics:**

- Simple 6-digit numeric identifier
- No embedded date information
- Used for papers submitted before 2019
- Dates must be obtained from the paper's metadata (JATS XML)

### 2. Current URL Format (2019 onwards)

The version number at the end of a bioRxiv URL (`vN`) is not part of the DOI.

**Pattern:** `10.1101/YYYY.MM.DD.XXXXXXvN` where:

- **`YYYY`** = 4-digit year
- **`MM`** = 2-digit month (01-12)
- **`DD`** = 2-digit day (01-31)
- **`XXXXXX`** = 6-digit unique identifier
- **`vN`** = optional version number (v1, v2, v3, etc.), part of the URL, not the DOI

**Examples:**

- `10.1101/2024.01.25.577295` - Paper submitted on January 25, 2024
- `10.1101/2023.12.01.999999` - Paper submitted on December 1, 2023
- `10.1101/2024.01.15.123456v2` - Version 2 of a paper submitted on January 15, 2024
- `10.1101/2020.06.30.456789` - Paper submitted on June 30, 2020

This date is the **received date**, not the accepted date.
