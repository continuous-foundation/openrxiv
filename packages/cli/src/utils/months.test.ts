import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateMonthRange,
  parseMonthInput,
  parseWildcardPattern,
  validateMonthFormat,
  sortMonthsChronologically,
  getCurrentMonth,
  getPreviousMonth,
  isFutureMonth,
} from './months.js';
import {
  getFolderStructure,
  removeDuplicateFolders,
  sortFoldersChronologically,
} from 'biorxiv-utils';

describe('Month Utilities', () => {
  beforeEach(() => {
    // Mock the current date to 2025-01-15 for consistent testing
    const mockDate = new Date('2025-01-15T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateMonthRange', () => {
    it('should generate months from current month back to 2018-12', () => {
      const months = generateMonthRange();

      // Should start from current month (2025-01)
      expect(months[0]).toBe('2025-01');

      // Should end at 2018-12
      expect(months[months.length - 1]).toBe('2018-12');

      // Should include 2018-12
      expect(months).toContain('2018-12');

      // Should not include 2018-11 or earlier
      expect(months).not.toContain('2018-11');
      expect(months).not.toContain('2017-12');

      // Should have correct number of months
      // From 2025-01 to 2018-12: (2025-2018+1) * 12 = 8 * 12 = 96 months
      // But we stop at 2018-12, so it's actually 74 months
      expect(months).toHaveLength(74);
    });

    it('should generate months in descending order (newest first)', () => {
      const months = generateMonthRange();

      // First few months should be newest
      expect(months[0]).toBe('2025-01');
      expect(months[1]).toBe('2024-12');
      expect(months[2]).toBe('2024-11');

      // Last few months should be oldest
      expect(months[months.length - 3]).toBe('2019-02');
      expect(months[months.length - 2]).toBe('2019-01');
      expect(months[months.length - 1]).toBe('2018-12');
    });
  });

  describe('parseMonthInput', () => {
    it('should handle single month', () => {
      const result = parseMonthInput('2025-01');
      expect(result).toEqual(['2025-01']);
    });

    it('should handle comma-separated months', () => {
      const result = parseMonthInput('2025-01,2024-12,2024-11');
      expect(result).toEqual(['2025-01', '2024-12', '2024-11']);
    });

    it('should handle comma-separated months with spaces', () => {
      const result = parseMonthInput(' 2025-01 , 2024-12 , 2024-11 ');
      expect(result).toEqual(['2025-01', '2024-12', '2024-11']);
    });

    it('should handle wildcard pattern', () => {
      const result = parseMonthInput('2024-*');
      expect(result).toHaveLength(12);
      expect(result).toContain('2024-01');
      expect(result).toContain('2024-12');
    });

    it('should filter out empty strings', () => {
      const result = parseMonthInput('2025-01,,2024-12,');
      expect(result).toEqual(['2025-01', '2024-12']);
    });
  });

  describe('parseWildcardPattern', () => {
    it('should parse valid wildcard pattern', () => {
      const result = parseWildcardPattern('2024-*');
      expect(result).toHaveLength(12);
      expect(result).toContain('2024-01');
      expect(result).toContain('2024-06');
      expect(result).toContain('2024-12');
    });

    it('should handle current year and stop at current month', () => {
      const result = parseWildcardPattern('2025-*');
      // Since we're mocking 2025-01, should only include January
      expect(result).toHaveLength(1);
      expect(result).toEqual(['2025-01']);
    });

    it('should throw error for invalid wildcard pattern', () => {
      expect(() => parseWildcardPattern('2024-')).toThrow('Invalid wildcard pattern');
      expect(() => parseWildcardPattern('2024-*x')).toThrow('Invalid wildcard pattern');
      expect(() => parseWildcardPattern('*-2024')).toThrow('Invalid wildcard pattern');
    });

    it('should handle past years correctly', () => {
      const result = parseWildcardPattern('2020-*');
      expect(result).toHaveLength(12);
      expect(result).toContain('2020-01');
      expect(result).toContain('2020-12');
    });
  });

  describe('validateMonthFormat', () => {
    it('should validate correct month formats', () => {
      expect(validateMonthFormat('2025-01')).toBe(true);
      expect(validateMonthFormat('2024-12')).toBe(true);
      expect(validateMonthFormat('2018-12')).toBe(true);
      expect(validateMonthFormat('2020-06')).toBe(true);
    });

    it('should reject invalid month formats', () => {
      expect(validateMonthFormat('2025-1')).toBe(false); // Missing leading zero
      expect(validateMonthFormat('2025-13')).toBe(false); // Invalid month
      expect(validateMonthFormat('2025-00')).toBe(false); // Invalid month
      expect(validateMonthFormat('2025-1a')).toBe(false); // Non-numeric
      expect(validateMonthFormat('2025')).toBe(false); // Missing month
      expect(validateMonthFormat('2025-01-01')).toBe(false); // Too many parts
    });

    it('should reject months outside valid year range', () => {
      expect(validateMonthFormat('2101-01')).toBe(false); // After 2100
    });

    it('should accept boundary years', () => {
      expect(validateMonthFormat('2018-01')).toBe(true);
      expect(validateMonthFormat('2018-12')).toBe(true);
      expect(validateMonthFormat('2100-01')).toBe(true);
      expect(validateMonthFormat('2100-12')).toBe(true);
    });
  });

  describe('sortMonthsChronologically', () => {
    it('should sort months in chronological order (oldest first)', () => {
      const months = ['2025-01', '2024-12', '2024-01', '2025-02'];
      const sorted = sortMonthsChronologically(months);

      expect(sorted).toEqual(['2024-01', '2024-12', '2025-01', '2025-02']);
    });

    it('should handle months within same year', () => {
      const months = ['2024-12', '2024-01', '2024-06'];
      const sorted = sortMonthsChronologically(months);

      expect(sorted).toEqual(['2024-01', '2024-06', '2024-12']);
    });

    it('should handle single month', () => {
      const months = ['2024-06'];
      const sorted = sortMonthsChronologically(months);

      expect(sorted).toEqual(['2024-06']);
    });

    it('should handle empty array', () => {
      const months: string[] = [];
      const sorted = sortMonthsChronologically(months);

      expect(sorted).toEqual([]);
    });
  });

  describe('getCurrentMonth', () => {
    it('should return current month in YYYY-MM format', () => {
      const currentMonth = getCurrentMonth();
      expect(currentMonth).toBe('2025-01');
    });
  });

  describe('getPreviousMonth', () => {
    it('should return previous month in YYYY-MM format', () => {
      const previousMonth = getPreviousMonth();
      expect(previousMonth).toBe('2024-12');
    });

    it('should handle year boundary correctly', () => {
      // Mock to January 2024 to test year boundary
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      const previousMonth = getPreviousMonth();
      expect(previousMonth).toBe('2023-12');
    });
  });

  describe('isFutureMonth', () => {
    it('should identify future months correctly', () => {
      expect(isFutureMonth('2025-02')).toBe(true);
      expect(isFutureMonth('2025-12')).toBe(true);
      expect(isFutureMonth('2026-01')).toBe(true);
    });

    it('should identify current and past months correctly', () => {
      expect(isFutureMonth('2025-01')).toBe(false); // Current month
      expect(isFutureMonth('2024-12')).toBe(false); // Past month
      expect(isFutureMonth('2024-01')).toBe(false); // Past month
      expect(isFutureMonth('2018-12')).toBe(false); // Past month
    });

    it('should handle year boundaries correctly', () => {
      expect(isFutureMonth('2024-12')).toBe(false); // Past year
      expect(isFutureMonth('2026-01')).toBe(true); // Future year
    });
  });

  describe('Integration tests', () => {
    it('should handle complete workflow: parse, validate, sort, deduplicate', () => {
      const input = '2025-01,2024-12,2025-01,2024-11,2024-12';

      // Parse input
      const parsed = parseMonthInput(input);
      expect(parsed).toEqual(['2025-01', '2024-12', '2025-01', '2024-11', '2024-12']);

      // Validate all months
      const valid = parsed.filter(validateMonthFormat);
      expect(valid).toEqual(['2025-01', '2024-12', '2025-01', '2024-11', '2024-12']);

      // Remove duplicates
      const folders = valid.map((month) => getFolderStructure({ month }));
      const unique = removeDuplicateFolders(folders);
      expect(unique.length).toEqual(3);

      // Sort chronologically
      const sorted = sortFoldersChronologically(unique);
      expect(sorted.length).toEqual(3);
      expect(sorted[0].batch).toEqual('November_2024');
      expect(sorted[1].batch).toEqual('December_2024');
      expect(sorted[2].batch).toEqual('January_2025');
    });

    it('should handle wildcard with validation and sorting', () => {
      const input = '2024-*';

      // Parse wildcard
      const parsed = parseMonthInput(input);
      expect(parsed).toHaveLength(12);

      // Validate all months
      const valid = parsed.filter(validateMonthFormat);
      expect(valid).toHaveLength(12);

      // Sort chronologically
      const sorted = sortMonthsChronologically(valid);
      expect(sorted[0]).toBe('2024-01');
      expect(sorted[11]).toBe('2024-12');
    });
  });
});
