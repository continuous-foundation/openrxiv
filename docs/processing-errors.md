---
title: Known Processing Errors
---

There are a number of known issues from the bulk process:

- The XML header `<?xml version="1.0" encoding="UTF-8"?>` is not on the first line (Invalid XML)
- The XML header `<?xml version="1.0" encoding="UTF-8"?>` sometimes has a prepended space (Invalid XML)
- There are invalid and unescaped `&`s in the text (Invalid XML)
- There are HTML codes, like `&nbsp;` instead of `&#160;`. (Invalid XML, not covered by any schema)

Some other issues identified:

- Some files have an accepted date, but no received date. We interpret the received date to be the same date.

# Specific Cases

`Current_Content/January_2025/f4db68bd-73d9-1014-bc02-e2ed0d1162a7.meca`
: This has the manifest.xml and the content folder **nested** under an ID folder. This is invalid.

`<fn id="n1"fn-type="equal">`
: Missing space between the `id="n1"` attribute and the `fn-type="equal"` attribute. In XML, attributes within an element must be separated by whitespace (spaces, tabs, or newlines).

# Duplicates

There are about 53 duplicate files in the bioRxiv dataset, that is, different files that point to the same DOI and version.
