import { describe, it, expect } from 'vitest';
import {
  validateListFilesRequest,
  parseFolderParameter,
  getBatchNameForLookup,
  convertMonthFormat,
} from '@/utils/bucket';

describe('Bucket Utility Functions', () => {
  describe('validateListFilesRequest', () => {
    it('should validate folder parameter correctly', () => {
      const result = validateListFilesRequest({
        folder: '2025-01',
        limit: '50',
        offset: '0',
      });

      expect(result.folder).toBe('2025-01');
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should validate batch format correctly', () => {
      const result = validateListFilesRequest({
        folder: 'Batch_01',
        limit: '100',
        offset: '10',
      });

      expect(result.folder).toBe('Batch_01');
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(10);
    });

    it('should throw error for missing folder parameter', () => {
      expect(() => {
        validateListFilesRequest({ limit: '50' });
      }).toThrow('Invalid input: expected string, received undefined');
    });
  });

  describe('parseFolderParameter', () => {
    it('should parse YYYY-MM format as month', () => {
      const result = parseFolderParameter('biorxiv', '2025-01');
      expect(result.type).toBe('current');
      expect(result.batch).toBe('January_2025');
    });

    it('should parse Month_YYYY format as month', () => {
      const result = parseFolderParameter('biorxiv', 'January_2025');
      expect(result.type).toBe('current');
      expect(result.batch).toBe('January_2025');
    });

    it('should parse batch format correctly', () => {
      const result = parseFolderParameter('biorxiv', 'Batch_01');
      expect(result.type).toBe('back');
      expect(result.batch).toBe('Batch_01');
    });

    it('should parse numeric batch format correctly', () => {
      const result = parseFolderParameter('biorxiv', '1');
      expect(result.type).toBe('back');
      expect(result.batch).toBe('Batch_01');
    });

    it('should throw error for invalid format', () => {
      expect(() => {
        parseFolderParameter('biorxiv', 'invalid-format');
      }).toThrow(
        'Invalid folder format: invalid-format. Folder must be as a month (YYYY-MM or Month_YYYY) or batch format (Batch_NN or medRxiv_Batch_NN or NN).',
      );
    });
  });

  describe('getBatchNameForLookup', () => {
    it('should convert month format to Month_YYYY for database lookup', () => {
      const result = getBatchNameForLookup('biorxiv', '2025-01');
      expect(result).toBe('January_2025');
    });

    it('should return batch name as-is for batch format', () => {
      const result = getBatchNameForLookup('biorxiv', 'Batch_01');
      expect(result).toBe('Batch_01');
    });

    it('should handle Month_YYYY input correctly', () => {
      const result = getBatchNameForLookup('biorxiv', 'January_2025');
      expect(result).toBe('January_2025');
    });
  });

  describe('convertMonthFormat', () => {
    it('should convert YYYY-MM to Month_YYYY', () => {
      const result = convertMonthFormat('2025-01');
      expect(result).toBe('January_2025');
    });

    it('should convert YYYY-MM to Month_YYYY for December', () => {
      const result = convertMonthFormat('2025-12');
      expect(result).toBe('December_2025');
    });
  });
});
