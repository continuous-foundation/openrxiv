/**
 * Month utility functions for batch processing
 */

/**
 * Generate a range of months to process backwards from current month to 2018-12
 */
export function generateMonthRange(): string[] {
  const months: string[] = [];
  const now = new Date();
  const currentDate = new Date(now.getFullYear(), now.getMonth(), 1);

  // Go back from current month to December 2018
  while (currentDate.getFullYear() >= 2018) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');

    // Stop at 2018-12 (inclusive)
    if (year === 2018 && month === '12') {
      months.push('2018-12');
      break;
    }

    months.push(`${year}-${month}`);

    // Move to previous month
    currentDate.setMonth(currentDate.getMonth() - 1);
  }

  return months;
}

/**
 * Parse month input and return array of months to process
 */
export function parseMonthInput(monthInput: string): string[] {
  // Handle comma-separated list
  if (monthInput.includes(',')) {
    const parts = monthInput
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    // Process each part (which may contain wildcards)
    const result: string[] = [];
    for (const part of parts) {
      if (part.includes('*')) {
        // Expand wildcard pattern
        result.push(...parseWildcardPattern(part));
      } else {
        // Single month
        result.push(part);
      }
    }
    return result;
  }

  // Handle wildcard pattern (e.g., "2025-*")
  if (monthInput.includes('*')) {
    return parseWildcardPattern(monthInput);
  }

  // Single month
  return [monthInput];
}

/**
 * Parse wildcard pattern like "2025-*" to get all months in that year
 */
export function parseWildcardPattern(pattern: string): string[] {
  const months: string[] = [];

  // Extract year from pattern
  const yearMatch = pattern.match(/^(\d{4})-\*$/);
  if (!yearMatch) {
    throw new Error(`Invalid wildcard pattern: ${pattern}. Use format like "2025-*"`);
  }

  const year = parseInt(yearMatch[1], 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Generate all months in the year, but only up to current month if it's current year
  for (let month = 1; month <= 12; month++) {
    if (year === currentYear && month > currentMonth) {
      break; // Don't process future months
    }
    const monthStr = String(month).padStart(2, '0');
    months.push(`${year}-${monthStr}`);
  }

  return months;
}

/**
 * Validate month format (YYYY-MM)
 */
export function validateMonthFormat(month: string): boolean {
  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(month)) {
    return false;
  }

  const [year, monthNum] = month.split('-');
  const yearNum = parseInt(year, 10);
  const monthInt = parseInt(monthNum, 10);

  return yearNum <= 2100 && monthInt >= 1 && monthInt <= 12;
}

/**
 * Sort months chronologically (oldest first)
 */
export function sortMonthsChronologically(months: string[]): string[] {
  return months.sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);

    if (yearA !== yearB) {
      return yearA - yearB;
    }
    return monthA - monthB;
  });
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get previous month in YYYY-MM format
 */
export function getPreviousMonth(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Check if a month is in the future
 */
export function isFutureMonth(month: string): boolean {
  const [year, monthNum] = month.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return year > currentYear || (year === currentYear && monthNum > currentMonth);
}
