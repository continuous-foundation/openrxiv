/**
 * Utility functions for parsing bioRxiv URLs and DOIs
 */

export interface ParsedBiorxivURL {
  doi: string;
  baseDOI: string;
  version: string | null;
  fullURL: string;
  isValid: boolean;
}

export interface DOIParts {
  doi: string;
  prefix: string;
  suffix: string;
  date: string;
  identifier: string;
  version: string | null;
}

/**
 * Extract DOI from a bioRxiv URL
 */
export function extractDOIFromURL(url: string): string | null {
  // Handle various bioRxiv URL formats
  let doi = null;

  // Check for bioRxiv content URLs
  if (url.includes('biorxiv.org/content/')) {
    const match = url.match(/biorxiv\.org\/content\/([^?#]+)/);
    if (match && match[1]) {
      doi = match[1];
    }
  }
  // Check for doi.org redirects
  else if (url.includes('doi.org/')) {
    const match = url.match(/doi\.org\/([^?#]+)/);
    if (match && match[1]) {
      doi = match[1];
    }
  }
  // Check for direct DOI input
  else if (url.startsWith('10.1101/')) {
    doi = url;
  }

  if (doi) {
    // Clean up the extracted DOI (remove any trailing extensions)
    return doi.replace(/\.(article-info|full|abstract|pdf|suppl)$/, '');
  }

  return null;
}

/**
 * Parse a bioRxiv DOI into its components
 */
export function parseDOI(doi: string): DOIParts | null {
  // bioRxiv DOI format: 10.1101/YYYY.MM.DD.XXXXXXvN
  const pattern = /^10\.1101\/(\d{4})\.(\d{2})\.(\d{2})\.(\d{6})(v\d+)?$/;
  const match = doi.match(pattern);

  if (!match) {
    return null;
  }
  const [prefix, suffix] = doi.split('/');

  const [, year, month, day, identifier, version] = match;
  const date = `${year}-${month}-${day}`;

  return {
    doi,
    prefix,
    suffix: suffix.replace(/(v\d+)$/, ''),
    date,
    identifier,
    version: version || null,
  };
}

/**
 * Extract base DOI (without version)
 */
export function extractBaseDOI(doi: string): string {
  return doi.replace(/v\d+$/, '');
}

/**
 * Extract version from DOI
 */
export function extractVersion(doi: string): string | null {
  const match = doi.match(/v(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Check if a DOI is a valid bioRxiv DOI
 */
export function isValidBiorxivDOI(doi: string): boolean {
  return parseDOI(doi) !== null;
}

/**
 * Check if a URL is a valid bioRxiv URL
 */
export function isValidBiorxivURL(url: string): boolean {
  const doi = extractDOIFromURL(url);
  return doi !== null && isValidBiorxivDOI(doi);
}

/**
 * Parse a bioRxiv URL and extract all relevant information
 */
export function parseBiorxivURL(url: string): ParsedBiorxivURL | null {
  const doi = extractDOIFromURL(url);

  if (!doi || !isValidBiorxivDOI(doi)) {
    return null;
  }

  const baseDOI = extractBaseDOI(doi);
  const version = extractVersion(doi);

  return {
    doi,
    baseDOI,
    version,
    fullURL: url,
    isValid: true,
  };
}

/**
 * Format a DOI for display
 */
export function formatDOI(doi: string): string {
  const parts = parseDOI(doi);
  if (!parts) return doi;

  if (parts.version) {
    return `${parts.prefix}/${parts.date}.${parts.identifier} (${parts.version})`;
  }

  return `${parts.prefix}/${parts.date}.${parts.identifier}`;
}

/**
 * Get a human-readable date from a bioRxiv DOI
 */
export function getDateFromDOI(doi: string): Date | null {
  const parts = parseDOI(doi);
  if (!parts) return null;

  const [year, month, day] = parts.date.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * Check if a DOI is from a specific time period
 */
export function isDOIInPeriod(doi: string, startDate: Date, endDate: Date): boolean {
  const doiDate = getDateFromDOI(doi);
  if (!doiDate) return false;

  return doiDate >= startDate && doiDate <= endDate;
}

/**
 * Get the expected S3 path for a bioRxiv DOI
 */
export function getExpectedS3Path(doi: string): string | null {
  const doiDate = getDateFromDOI(doi);
  if (!doiDate) return null;

  const month = doiDate.toLocaleString('en-US', { month: 'long' });
  const year = doiDate.getFullYear();

  // Current content (after 2019)
  if (doiDate >= new Date('2019-01-01')) {
    return `Current_Content/${month}_${year}/`;
  }

  // Back content (before 2019)
  return `Back_Content/Batch_01/`;
}
