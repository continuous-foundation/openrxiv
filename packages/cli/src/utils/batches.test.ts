import { describe, it, expect } from 'vitest';
import { parseBatchInput, validateBatchFormat } from './batches.js';

describe('Batch Utilities', () => {
  describe('parseBatchInput', () => {
    describe('single batches', () => {
      it('should parse single numeric batch', () => {
        expect(parseBatchInput('1')).toEqual(['1']);
        expect(parseBatchInput('42')).toEqual(['42']);
      });

      it('should parse single named batch', () => {
        expect(parseBatchInput('batch-1')).toEqual(['batch-1']);
        expect(parseBatchInput('Batch_01')).toEqual(['Batch_01']);
        expect(parseBatchInput('historical-content')).toEqual(['historical-content']);
      });
    });

    describe('numeric ranges', () => {
      it('should parse simple ranges', () => {
        expect(parseBatchInput('1-3')).toEqual(['1', '2', '3']);
        expect(parseBatchInput('5-10')).toEqual(['5', '6', '7', '8', '9', '10']);
        expect(parseBatchInput('1-1')).toEqual(['1']);
      });

      it('should handle large ranges', () => {
        const result = parseBatchInput('1-100');
        expect(result).toHaveLength(100);
        expect(result[0]).toBe('1');
        expect(result[99]).toBe('100');
      });

      it('should reject invalid ranges', () => {
        expect(() => parseBatchInput('10-5')).toThrow(
          'Invalid batch range: start (10) cannot be greater than end (5)',
        );
        expect(() => parseBatchInput('5-5')).not.toThrow(); // Valid single-item range
      });

      it('should reject ranges that are too large', () => {
        expect(() => parseBatchInput('1-102')).toThrow(
          'Batch range too large: 102 batches. Maximum allowed: 100',
        );
        expect(() => parseBatchInput('1-101')).toThrow(
          'Batch range too large: 101 batches. Maximum allowed: 100',
        );
        expect(() => parseBatchInput('1-100')).not.toThrow(); // Valid maximum range
      });
    });

    describe('comma-separated lists', () => {
      it('should parse simple comma-separated lists', () => {
        expect(parseBatchInput('1,2,3')).toEqual(['1', '2', '3']);
        expect(parseBatchInput('batch-1,batch-2,batch-3')).toEqual([
          'batch-1',
          'batch-2',
          'batch-3',
        ]);
      });

      it('should handle whitespace in comma-separated lists', () => {
        expect(parseBatchInput('1, 2, 3')).toEqual(['1', '2', '3']);
        expect(parseBatchInput(' 1 , 2 , 3 ')).toEqual(['1', '2', '3']);
      });

      it('should filter out empty entries', () => {
        expect(parseBatchInput('1,,2,3')).toEqual(['1', '2', '3']);
        expect(parseBatchInput('1, ,2,3')).toEqual(['1', '2', '3']);
      });
    });

    describe('mixed formats', () => {
      it('should handle ranges within comma-separated lists', () => {
        expect(parseBatchInput('1-3,5,7-9')).toEqual(['1', '2', '3', '5', '7', '8', '9']);
        expect(parseBatchInput('1-5,10,15-17')).toEqual([
          '1',
          '2',
          '3',
          '4',
          '5',
          '10',
          '15',
          '16',
          '17',
        ]);
      });

      it('should handle complex mixed formats', () => {
        expect(parseBatchInput('1-3,batch-1,5-7,historical')).toEqual([
          '1',
          '2',
          '3',
          'batch-1',
          '5',
          '6',
          '7',
          'historical',
        ]);
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        expect(parseBatchInput('')).toEqual(['']);
      });

      it('should handle single comma', () => {
        expect(parseBatchInput(',')).toEqual([]);
      });

      it('should handle multiple commas', () => {
        expect(parseBatchInput(',,')).toEqual([]);
        expect(parseBatchInput('1,,2')).toEqual(['1', '2']);
      });
    });
  });

  describe('validateBatchFormat', () => {
    it('should accept valid batch names', () => {
      expect(validateBatchFormat('1')).toBe(true);
      expect(validateBatchFormat('42')).toBe(true);
      expect(validateBatchFormat('batch-1')).toBe(true);
      expect(validateBatchFormat('Batch_01')).toBe(true);
      expect(validateBatchFormat('historical-content')).toBe(true);
      expect(validateBatchFormat('content_2023')).toBe(true);
    });

    it('should reject invalid batch names', () => {
      expect(validateBatchFormat('')).toBe(false);
      expect(validateBatchFormat('batch 1')).toBe(false); // space not allowed
      expect(validateBatchFormat('batch.1')).toBe(false); // dot not allowed
      expect(validateBatchFormat('batch/1')).toBe(false); // slash not allowed
      expect(validateBatchFormat('batch@1')).toBe(false); // @ not allowed
    });

    it('should handle special characters correctly', () => {
      expect(validateBatchFormat('batch-1')).toBe(true); // hyphen allowed
      expect(validateBatchFormat('batch_1')).toBe(true); // underscore allowed
      expect(validateBatchFormat('Batch01')).toBe(true); // alphanumeric allowed
    });
  });
});
