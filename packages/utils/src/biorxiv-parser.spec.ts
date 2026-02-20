import { describe, it, expect } from 'vitest';
import {
  extractDOIFromURL,
  parseDOI,
  extractBaseDOI,
  extractVersion,
  isValidBiorxivDOI,
  isValidBiorxivURL,
  parseBiorxivURL,
} from './biorxiv-parser.js';

describe('BioRxiv URL Parser', () => {
  describe('extractDOIFromURL', () => {
    it.each([
      [
        'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3',
        '10.1101/2024.01.25.577295v3',
      ],
      [
        'https://www.medrxiv.org/content/10.1101/2020.03.19.20039131v2',
        '10.1101/2020.03.19.20039131v2',
      ],
      [
        'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.article-info',
        '10.1101/2024.01.25.577295v3',
      ],
      [
        'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.full',
        '10.1101/2024.01.25.577295v3',
      ],
      [
        'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.abstract',
        '10.1101/2024.01.25.577295v3',
      ],
      [
        'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.pdf',
        '10.1101/2024.01.25.577295v3',
      ],
      [
        'https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.suppl',
        '10.1101/2024.01.25.577295v3',
      ],
      ['https://doi.org/10.1101/2024.01.25.577295v3', '10.1101/2024.01.25.577295v3'],
      ['10.1101/2024.01.25.577295v3', '10.1101/2024.01.25.577295v3'],
      // New prefix 10.64898 (Dec 2025+)
      ['10.64898/2025.12.15.123456v1', '10.64898/2025.12.15.123456v1'],
      [
        'https://www.biorxiv.org/content/10.64898/2025.12.01.999999v2',
        '10.64898/2025.12.01.999999v2',
      ],
    ])('should extract DOI from standard content URL', (url, expected) => {
      const result = extractDOIFromURL(url);
      expect(result).toBe(expected);
    });

    it.each([
      ['https://example.com/not-biorxiv', null],
      ['https://biorxiv.org/invalid-path', null],
      ['not-a-url', null],
      ['', null],
      ['https://biorxiv.org/', null],
    ])('should return null for invalid URLs', (url, expected) => {
      const result = extractDOIFromURL(url);
      expect(result).toBe(expected);
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

    it('should parse DOI with new 10.64898 prefix (Dec 2025+)', () => {
      const doi = '10.64898/2025.12.15.123456v1';
      const result = parseDOI(doi);

      expect(result).toEqual({
        doi: '10.64898/2025.12.15.123456v1',
        prefix: '10.64898',
        date: '2025-12-15',
        identifier: '123456',
        suffix: '2025.12.15.123456',
        version: 'v1',
      });
    });

    it('should return null for invalid DOI format', () => {
      const invalidDOIs = [
        '10.1000/123.456.789',
        '10.1101/2024.1.25.577295',
        '10.1101/2024.01.25.57729',
        '10.1101/2024.01.25.5772955666',
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
    it.each([
      ['10.1101/2024.01.25.577295', '10.1101/2024.01.25.577295'], // Same DOI
      ['10.1101/2024.01.25.577295v3', '10.1101/2024.01.25.577295'], // Remove version
      ['10.1101/2024.01.25.577295v12', '10.1101/2024.01.25.577295'], // Remove double digit version
      ['10.1101/2020.03.19.20039131v2', '10.1101/2020.03.19.20039131'], // medrxiv variant
      ['10.64898/2025.12.15.123456v1', '10.64898/2025.12.15.123456'],
    ])('should extract base DOI from versioned DOI', (doi, expected) => {
      const result = extractBaseDOI(doi);
      expect(result).toBe(expected);
    });
  });

  describe('extractVersion', () => {
    it.each([
      ['10.1101/2024.01.25.577295v3', '3'],
      ['10.1101/2024.01.25.577295', null],
      ['10.1101/2024.01.25.577295v12', '12'],
    ])('should extract version from DOI', (doi, expected) => {
      const result = extractVersion(doi);
      expect(result).toBe(expected);
    });
  });

  describe('isValidBiorxivDOI', () => {
    it.each([
      // Valid DOIs
      ['10.1101/2024.01.25.577295v3', true],
      ['10.1101/2024.01.25.577295', true],
      ['10.1101/2020.01.15.123456v2', true],
      ['10.1101/2018.01.15.789012', true],
      ['10.1101/789012', true],
      ['10.1101/789012v12', true],
      ['10.1101/789012v3', true],
      ['10.1101/2020.03.19.20039131v2', true],
      ['10.64898/2025.12.15.123456', true],
      ['10.64898/2025.12.01.999999v1', true],
      ['10.64898/789012', true],
      ['10.64898/789012v3', true],
      ['10.1101/2024.1.25.577295', false],
      ['10.1101/2024.01.25.57729', false],
      ['invalid-doi', false],
      ['10.1101/78901', false],
      ['10.1101/78901v3', false],
      ['', false],
    ])('should validate correct bioRxiv DOIs %s', (doi, expected) => {
      const result = isValidBiorxivDOI(doi);
      expect(result).toBe(expected);
    });
  });

  describe('isValidBiorxivURL', () => {
    it.each([
      ['https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3', true],
      ['https://www.biorxiv.org/content/10.1101/2024.01.25.577295v3.article-info', true],
      ['https://doi.org/10.1101/2024.01.25.577295v3', true],
      ['10.1101/2024.01.25.577295v3', true],
      ['https://www.biorxiv.org/content/10.1101/486050v2.article-info', true],
      ['https://www.biorxiv.org/content/10.1101/486050', true],
      ['10.64898/2025.12.15.123456v1', true],
      ['https://www.biorxiv.org/content/10.64898/2025.12.01.999999v2', true],
      // Invalid
      ['https://example.com/not-biorxiv', false],
      ['https://biorxiv.org/invalid-path', false],
      ['10.1000/123.456.789', false],
      ['invalid-url', false],
      ['', false],
    ])('should validate correct bioRxiv URLs', (url, expected) => {
      const result = isValidBiorxivURL(url);
      expect(result).toBe(expected);
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
