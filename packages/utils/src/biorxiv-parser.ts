/**
 * Utility functions for parsing bioRxiv URLs and DOIs
 */

/**
 * bioRxiv DOI prefixes - both legacy (10.1101) and new (10.64898, Dec 2025+)
 */
export const BIORXIV_DOI_PREFIXES = ['10.1101', '10.64898'] as const;
export const BIORXIV_DOI_PREFIX_PATTERN = '(10\\.1101|10\\.64898)';

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
  date: string | null;
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
  // Check for medRxiv content URLs
  else if (url.includes('medrxiv.org/content/')) {
    const match = url.match(/medrxiv\.org\/content\/([^?#]+)/);
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
  // Check for direct DOI input (both 10.1101 and 10.64898 prefixes)
  else if (url.startsWith('10.1101/') || url.startsWith('10.64898/')) {
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
 * Supports both legacy numeric format (2019 and earlier) and current date-based format (2019+)
 */
export function parseDOI(doi: string): DOIParts | null {
  // Handle current date-based format (2019+): {prefix}/YYYY.MM.DD.XXXXXXvN
  const currentPattern = new RegExp(
    `^${BIORXIV_DOI_PREFIX_PATTERN}/(\\d{4})\\.(\\d{2})\\.(\\d{2})\\.(\\d{6,8})(v\\d+)?$`,
  );
  const currentMatch = doi.match(currentPattern);

  if (currentMatch) {
    const [prefix, suffix] = doi.split('/');
    const [, , year, month, day, identifier, version] = currentMatch;
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

  // Handle legacy numeric format (2019 and earlier): {prefix}/XXXXXX (10.1101 only; 10.64898 uses date format)
  const legacyPattern = new RegExp(`^${BIORXIV_DOI_PREFIX_PATTERN}/(\\d{6,8})(v\\d+)?$`);
  const legacyMatch = doi.match(legacyPattern);

  if (legacyMatch) {
    const [prefix, suffix] = doi.split('/');
    const [, identifier, version] = legacyMatch;
    return {
      doi,
      prefix,
      suffix: suffix.replace(/(v\d+)$/, ''),
      date: null,
      identifier,
      version: version || null,
    };
  }

  return null;
}

/**
 * Extract base DOI (without version)
 * Works with both legacy numeric and current date-based formats
 */
export function extractBaseDOI(doi: string): string {
  // Remove version suffix if present
  return doi.replace(/v\d+$/, '');
}

/**
 * Extract version from DOI
 * Works with both legacy numeric and current date-based formats
 */
export function extractVersion(doi: string): string | null {
  const match = doi.match(/v(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Check if a DOI is a valid bioRxiv DOI
 * Supports both legacy numeric and current date-based formats
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
