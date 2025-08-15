import { describe, it, expect } from 'vitest';
import {
  extractDOIFromURL,
  parseDOI,
  extractBaseDOI,
  extractVersion,
  isValidBiorxivDOI,
  isValidBiorxivURL,
  parseBiorxivURL,
  formatDOI,
  getDateFromDOI,
  getExpectedS3Path,
  isDOIInPeriod,
} from './biorxiv-parser.js';

describe('BioRxiv URL Parser', () => {
  describe('extractDOIFromURL', () => {
    it('should extract DOI from standard content URL', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should extract DOI from article-info URL', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.article-info';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should extract DOI from full text URL', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.full';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should extract DOI from abstract URL', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.abstract';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should extract DOI from PDF URL', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.pdf';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should extract DOI from supplementary URL', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.suppl';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should extract DOI from doi.org redirect', () => {
      const url = 'https://doi.org/10.1101/2024.01.25.577295v3';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should handle direct DOI input', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const result = extractDOIFromURL(doi);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'https://example.com/not-biorxiv',
        'https://biorxiv.org/invalid-path',
        'not-a-url',
        '',
        'https://biorxiv.org/',
      ];

      invalidUrls.forEach((url) => {
        const result = extractDOIFromURL(url);
        expect(result).toBeNull();
      });
    });
  });

  describe('parseDOI', () => {
    it('should parse DOI with version', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const result = parseDOI(doi);

      expect(result).toEqual({
        doi: '10.1101/2024.01.25.577295v3',
        prefix: '10.1101',
        date: '2024-01-25',
        identifier: '577295',
        suffix: '2024.01.25.577295',
        version: 'v3',
      });
    });

    it('should parse DOI without version', () => {
      const doi = '10.1101/2024.01.25.577295';
      const result = parseDOI(doi);

      expect(result).toEqual({
        doi: '10.1101/2024.01.25.577295',
        prefix: '10.1101',
        date: '2024-01-25',
        identifier: '577295',
        suffix: '2024.01.25.577295',
        version: null,
      });
    });

    it('should parse DOI with single digit month and day', () => {
      const doi = '10.1101/2024.01.05.123456v1';
      const result = parseDOI(doi);

      expect(result).toEqual({
        doi: '10.1101/2024.01.05.123456v1',
        prefix: '10.1101',
        date: '2024-01-05',
        identifier: '123456',
        suffix: '2024.01.05.123456',
        version: 'v1',
      });
    });

    it('should return null for invalid DOI format', () => {
      const invalidDOIs = [
        '10.1000/123.456.789',
        '10.1101/2024.1.25.577295',
        '10.1101/2024.01.25.57729',
        '10.1101/2024.01.25.5772955',
        '10.1101/2024.01.25.577295v',
        '10.1101/2024.01.25.577295v',
        'invalid-doi',
        '',
      ];

      invalidDOIs.forEach((doi) => {
        const result = parseDOI(doi);
        expect(result).toBeNull();
      });
    });
  });

  describe('extractBaseDOI', () => {
    it('should extract base DOI from versioned DOI', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const result = extractBaseDOI(doi);
      expect(result).toBe('10.1101/2024.01.25.577295');
    });

    it('should return same DOI if no version', () => {
      const doi = '10.1101/2024.01.25.577295';
      const result = extractBaseDOI(doi);
      expect(result).toBe('10.1101/2024.01.25.577295');
    });

    it('should handle multiple version digits', () => {
      const doi = '10.1101/2024.01.25.577295v12';
      const result = extractBaseDOI(doi);
      expect(result).toBe('10.1101/2024.01.25.577295');
    });
  });

  describe('extractVersion', () => {
    it('should extract version from DOI', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const result = extractVersion(doi);
      expect(result).toBe('3');
    });

    it('should return null for DOI without version', () => {
      const doi = '10.1101/2024.01.25.577295';
      const result = extractVersion(doi);
      expect(result).toBeNull();
    });

    it('should handle double digit versions', () => {
      const doi = '10.1101/2024.01.25.577295v12';
      const result = extractVersion(doi);
      expect(result).toBe('12');
    });
  });

  describe('isValidBiorxivDOI', () => {
    it('should validate correct bioRxiv DOIs', () => {
      const validDOIs = [
        '10.1101/2024.01.25.577295v3',
        '10.1101/2024.01.25.577295',
        '10.1101/2020.01.15.123456v2',
        '10.1101/2018.01.15.789012',
      ];

      validDOIs.forEach((doi) => {
        expect(isValidBiorxivDOI(doi)).toBe(true);
      });
    });

    it('should reject invalid DOIs', () => {
      const invalidDOIs = [
        '10.1000/123.456.789',
        '10.1101/2024.1.25.577295',
        '10.1101/2024.01.25.57729',
        'invalid-doi',
        '',
      ];

      invalidDOIs.forEach((doi) => {
        expect(isValidBiorxivDOI(doi)).toBe(false);
      });
    });
  });

  describe('isValidBiorxivURL', () => {
    it('should validate correct bioRxiv URLs', () => {
      const validURLs = [
        'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3',
        'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.article-info',
        'https://doi.org/10.1101/2024.01.25.577295v3',
        '10.1101/2024.01.25.577295v3',
      ];

      validURLs.forEach((url) => {
        expect(isValidBiorxivURL(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidURLs = [
        'https://example.com/not-biorxiv',
        'https://biorxiv.org/invalid-path',
        '10.1000/123.456.789',
        'invalid-url',
        '',
      ];

      invalidURLs.forEach((url) => {
        expect(isValidBiorxivURL(url)).toBe(false);
      });
    });
  });

  describe('parseBiorxivURL', () => {
    it('should parse valid bioRxiv URL', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.article-info';
      const result = parseBiorxivURL(url);

      expect(result).toEqual({
        doi: '10.1101/2024.01.25.577295v3',
        baseDOI: '10.1101/2024.01.25.577295',
        version: '3',
        fullURL: url,
        isValid: true,
      });
    });

    it('should parse URL without version', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295';
      const result = parseBiorxivURL(url);

      expect(result).toEqual({
        doi: '10.1101/2024.01.25.577295',
        baseDOI: '10.1101/2024.01.25.577295',
        version: null,
        fullURL: url,
        isValid: true,
      });
    });

    it('should return null for invalid URL', () => {
      const url = 'https://example.com/not-biorxiv';
      const result = parseBiorxivURL(url);
      expect(result).toBeNull();
    });
  });

  describe('formatDOI', () => {
    it('should format DOI with version', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const result = formatDOI(doi);
      expect(result).toBe('10.1101/2024-01-25.577295 (v3)');
    });

    it('should format DOI without version', () => {
      const doi = '10.1101/2024.01.25.577295';
      const result = formatDOI(doi);
      expect(result).toBe('10.1101/2024-01-25.577295');
    });

    it('should return original DOI if parsing fails', () => {
      const doi = 'invalid-doi';
      const result = formatDOI(doi);
      expect(result).toBe('invalid-doi');
    });
  });

  describe('getDateFromDOI', () => {
    it('should extract date from valid DOI', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const result = getDateFromDOI(doi);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0); // January is 0
      expect(result?.getDate()).toBe(25);
    });

    it('should return null for invalid DOI', () => {
      const doi = 'invalid-doi';
      const result = getDateFromDOI(doi);
      expect(result).toBeNull();
    });
  });

  describe('getExpectedS3Path', () => {
    it('should return current content path for recent DOI', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const result = getExpectedS3Path(doi);
      expect(result).toBe('Current_Content/January_2024/');
    });

    it('should return current content path for 2019 DOI', () => {
      const doi = '10.1101/2019.12.31.123456v1';
      const result = getExpectedS3Path(doi);
      expect(result).toBe('Current_Content/December_2019/');
    });

    it('should return back content path for old DOI', () => {
      const doi = '10.1101/2018.01.15.789012';
      const result = getExpectedS3Path(doi);
      expect(result).toBe('Back_Content/Batch_01/');
    });

    it('should return null for invalid DOI', () => {
      const doi = 'invalid-doi';
      const result = getExpectedS3Path(doi);
      expect(result).toBeNull();
    });
  });

  describe('isDOIInPeriod', () => {
    it('should return true for DOI in period', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const result = isDOIInPeriod(doi, startDate, endDate);
      expect(result).toBe(true);
    });

    it('should return false for DOI outside period', () => {
      const doi = '10.1101/2024.01.25.577295v3';
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      const result = isDOIInPeriod(doi, startDate, endDate);
      expect(result).toBe(false);
    });

    it('should return false for invalid DOI', () => {
      const doi = 'invalid-doi';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const result = isDOIInPeriod(doi, startDate, endDate);
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle DOIs with leading zeros in month/day', () => {
      const doi = '10.1101/2024.01.05.123456v1';
      const result = parseDOI(doi);

      expect(result).toEqual({
        doi: '10.1101/2024.01.05.123456v1',
        prefix: '10.1101',
        date: '2024-01-05',
        identifier: '123456',
        suffix: '2024.01.05.123456',
        version: 'v1',
      });
    });

    it('should handle DOIs with different identifier lengths', () => {
      const doi = '10.1101/2024.01.25.123456v1';
      const result = parseDOI(doi);

      expect(result?.identifier).toBe('123456');
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3?query=test';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });

    it('should handle URLs with fragments', () => {
      const url = 'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3#section';
      const result = extractDOIFromURL(url);
      expect(result).toBe('10.1101/2024.01.25.577295v3');
    });
  });
});
