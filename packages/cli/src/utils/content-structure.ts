/**
 * Utility functions for determining bioRxiv content structure
 * based on the date requested.
 *
 * According to bioRxiv documentation:
 * - Before late 2018: Files are in Back_Content/Batch_[nn]/ folders
 * - After late 2018: Files are in Current_Content/[Month]_[Year]/ folders
 */

export interface ContentStructure {
  type: 'current' | 'back';
  prefix: string;
  batch: string;
}

export interface ContentStructureOptions {
  month?: string;
  batch?: string;
  server?: string;
}

/**
 * Normalizes batch input to the standard "Batch_XX" format
 * @param batch - Batch input in various formats (e.g., "1", "batch-1", "Batch_01", "batch_01")
 * @param server - Server type to determine batch format (e.g., "biorxiv", "medrxiv")
 * @returns Normalized batch string in appropriate format
 */
export function normalizeBatch(batch: string | number, server: string = 'biorxiv'): string {
  if (typeof batch === 'number') {
    if (batch < 1) {
      throw new Error(
        `Invalid batch format: ${batch}. Expected a positive number or batch identifier.`,
      );
    }
    const batchNum = batch.toString().padStart(2, '0');
    return server.toLowerCase() === 'medrxiv' ? `medRxiv_Batch_${batchNum}` : `Batch_${batchNum}`;
  }

  // Remove common prefixes and normalize
  const normalized = batch
    .toLowerCase()
    .replace(/^batch[-_]?/i, '') // Remove "batch", "batch-", "batch_"
    .replace(/^medrxiv[-_]?batch[-_]?/i, '') // Remove "medrxiv_batch", "medrxiv-batch", etc.
    .replace(/^0+/, '') // Remove leading zeros
    .trim();

  // Parse the number and format it
  const batchNum = parseInt(normalized, 10);
  if (isNaN(batchNum) || batchNum < 1) {
    throw new Error(
      `Invalid batch format: ${batch}. Expected a positive number or batch identifier.`,
    );
  }

  const formattedBatchNum = batchNum.toString().padStart(2, '0');
  return server.toLowerCase() === 'medrxiv'
    ? `medRxiv_Batch_${formattedBatchNum}`
    : `Batch_${formattedBatchNum}`;
}

/**
 * Determines the content structure for a given month or batch
 * @param options - Options containing month or batch
 * @returns ContentStructure with the appropriate prefix and type
 */
export function getContentStructure(options: ContentStructureOptions): ContentStructure {
  if (options.month && options.batch) {
    throw new Error('Either month or batch must be specified, not both');
  }
  if (!options.month && !options.batch) {
    throw new Error('Either month or batch must be specified');
  }

  if (options.batch) {
    // If batch is specified, use Back_Content structure
    const normalizedBatch = normalizeBatch(options.batch, options.server);
    return {
      type: 'back',
      prefix: `Back_Content/${normalizedBatch}/`,
      batch: normalizedBatch,
    };
  }

  if (options.month) {
    // Normalize month format to YYYY-MM
    const normalizedMonth = normalizeMonthToYYYYMM(options.month);

    if (!normalizedMonth) {
      throw new Error(
        `Invalid month format: ${options.month}. Expected YYYY-MM or Month_YYYY format.`,
      );
    }

    const [year, monthNum] = normalizedMonth.split('-').map(Number);

    // bioRxiv switched from Back_Content to Current_Content in late 2018
    // We'll use December 2018 as the cutoff point to be safe
    const cutoffDate = new Date(2018, 11, 1); // December 1, 2018 (0-indexed month)
    const requestedDate = new Date(year, monthNum - 1, 1);

    if (requestedDate < cutoffDate) {
      // Use Back_Content structure - but we don't know which batch
      // User should specify batch explicitly for pre-2019 content
      throw new Error(
        `Date ${options.month} is in the Back_Content period. Please specify a batch using --batch option. ` +
          `Available batches can be listed with 'biorxiv list' command.`,
      );
    } else {
      // Use Current_Content structure
      const monthName = getMonthName(monthNum);
      return {
        type: 'current',
        prefix: `Current_Content/${monthName}_${year}/`,
        batch: `${monthName}_${year}`,
      };
    }
  }
  throw new Error('Invalid content structure options');
}

/**
 * Normalizes various month formats to YYYY-MM
 * @param month - Month in various formats
 * @returns Normalized YYYY-MM format or null if invalid
 */
function normalizeMonthToYYYYMM(month: string): string | null {
  // Already in YYYY-MM format
  if (month.match(/^\d{4}-\d{2}$/)) {
    const [, monthNum] = month.split('-').map(Number);
    if (monthNum < 1 || monthNum > 12) {
      return null; // Invalid month number
    }
    return month;
  }

  // Month_YYYY format (e.g., "November_2018")
  const monthYearMatch = month.match(/^([A-Za-z]+)_(\d{4})$/);
  if (monthYearMatch) {
    const monthName = monthYearMatch[1];
    const year = monthYearMatch[2];
    const monthNum = getMonthNumber(monthName);

    if (monthNum !== null) {
      return `${year}-${monthNum.toString().padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Gets month number from month name
 * @param monthName - Month name (case insensitive)
 * @returns Month number (1-12) or null if invalid
 */
function getMonthNumber(monthName: string): number | null {
  const monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];

  const normalizedName = monthName.toLowerCase();
  const monthIndex = monthNames.indexOf(normalizedName);

  return monthIndex !== -1 ? monthIndex + 1 : null;
}

/**
 * Gets month name from month number
 * @param monthNum - Month number (1-12)
 * @returns Month name (e.g., "January")
 */
function getMonthName(monthNum: number): string {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  if (monthNum < 1 || monthNum > 12) {
    throw new Error(`Invalid month number: ${monthNum}. Must be 1-12.`);
  }

  return monthNames[monthNum - 1];
}
