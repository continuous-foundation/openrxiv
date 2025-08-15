import { parseDOI, isValidBiorxivDOI, extractBaseDOI, extractVersion } from 'biorxiv-utils';

interface ParsedDOI {
  fullDOI: string;
  baseDOI: string;
  version: string | null;
  versionNumber: number | null;
  isValid: boolean;
  error?: string;
}

// Helper function to parse and validate DOI parameters
export function parseAndValidateDOI(doiPrefix: string, doiSuffix: string): ParsedDOI {
  const fullDOI = `${doiPrefix}/${doiSuffix}`;

  // Validate DOI format
  if (!isValidBiorxivDOI(fullDOI)) {
    return {
      fullDOI,
      baseDOI: '',
      version: null,
      versionNumber: null,
      isValid: false,
      error: 'Invalid bioRxiv DOI format',
    };
  }

  // Parse DOI to extract components
  const parsedDOI = parseDOI(fullDOI);
  if (!parsedDOI) {
    return {
      fullDOI,
      baseDOI: '',
      version: null,
      versionNumber: null,
      isValid: false,
      error: 'Could not parse DOI',
    };
  }

  const baseDOI = extractBaseDOI(fullDOI);
  const version = extractVersion(fullDOI);
  const versionNumber = version ? parseInt(version.replace('v', ''), 10) : null;

  if (version && (!versionNumber || Number.isNaN(versionNumber))) {
    return {
      fullDOI,
      baseDOI,
      version,
      versionNumber: null,
      isValid: false,
      error: 'Invalid version format',
    };
  }

  return {
    fullDOI,
    baseDOI,
    version,
    versionNumber,
    isValid: true,
  };
}
