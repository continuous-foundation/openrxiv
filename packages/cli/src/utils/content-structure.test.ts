import { describe, it, expect } from 'vitest';
import { getContentStructure, normalizeBatch } from './content-structure.js';

describe('Content Structure Utilities', () => {
  describe('normalizeBatch', () => {
    it.each([
      // Number inputs
      [1, 'Batch_01'],
      [5, 'Batch_05'],
      [10, 'Batch_10'],
      [25, 'Batch_25'],
      [100, 'Batch_100'],

      // String inputs with various formats
      ['1', 'Batch_01'],
      ['5', 'Batch_05'],
      ['10', 'Batch_10'],
      ['01', 'Batch_01'],
      ['05', 'Batch_05'],

      // With "batch" prefix
      ['batch1', 'Batch_01'],
      ['batch-1', 'Batch_01'],
      ['batch_1', 'Batch_01'],
      ['Batch1', 'Batch_01'],
      ['BATCH-1', 'Batch_01'],
      ['BATCH_1', 'Batch_01'],

      // With leading zeros
      ['001', 'Batch_01'],
      ['005', 'Batch_05'],
      ['010', 'Batch_10'],
      ['batch001', 'Batch_01'],
      ['batch-001', 'Batch_01'],
      ['batch_001', 'Batch_01'],

      // Edge cases
      ['batch-01', 'Batch_01'],
      ['batch_01', 'Batch_01'],
      ['Batch_01', 'Batch_01'],
      ['BATCH_01', 'Batch_01'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeBatch(input)).toBe(expected);
    });

    it.each([
      ['0', 'Invalid batch format: 0. Expected a positive number or batch identifier.'],
      ['-1', 'Invalid batch format: -1. Expected a positive number or batch identifier.'],
      ['abc', 'Invalid batch format: abc. Expected a positive number or batch identifier.'],
      [
        'batch-abc',
        'Invalid batch format: batch-abc. Expected a positive number or batch identifier.',
      ],
      ['', 'Invalid batch format: . Expected a positive number or batch identifier.'],
      ['batch-', 'Invalid batch format: batch-. Expected a positive number or batch identifier.'],
      ['batch_', 'Invalid batch format: batch_. Expected a positive number or batch identifier.'],
    ])('should throw error for invalid input "%s"', (input, expectedError) => {
      expect(() => normalizeBatch(input)).toThrow(expectedError);
    });

    it.each([
      [0, 'Invalid batch format: 0. Expected a positive number or batch identifier.'],
      [-1, 'Invalid batch format: -1. Expected a positive number or batch identifier.'],
      [-100, 'Invalid batch format: -100. Expected a positive number or batch identifier.'],
    ])('should throw error for invalid number input %d', (input, expectedError) => {
      expect(() => normalizeBatch(input)).toThrow(expectedError);
    });
  });

  describe('getContentStructure', () => {
    describe('with batch option', () => {
      it.each([
        ['1', 'Back_Content/Batch_01/'],
        ['5', 'Back_Content/Batch_05/'],
        ['10', 'Back_Content/Batch_10/'],
        ['batch1', 'Back_Content/Batch_01/'],
        ['batch-1', 'Back_Content/Batch_01/'],
        ['batch_1', 'Back_Content/Batch_01/'],
        ['Batch_01', 'Back_Content/Batch_01/'],
        ['BATCH_01', 'Back_Content/Batch_01/'],
      ])('should create Back_Content structure for batch "%s"', (batch, expectedPrefix) => {
        const result = getContentStructure({ batch });

        expect(result.type).toBe('back');
        expect(result.prefix).toBe(expectedPrefix);
        expect(result.batch).toBe(`Batch_${batch.replace(/\D/g, '').padStart(2, '0')}`);
      });
    });

    describe('with month option - Current Content period', () => {
      it.each([
        ['2019-01', 'Current_Content/January_2019/', 'January_2019'],
        ['2019-06', 'Current_Content/June_2019/', 'June_2019'],
        ['2019-12', 'Current_Content/December_2019/', 'December_2019'],
        ['2020-01', 'Current_Content/January_2020/', 'January_2020'],
        ['2024-01', 'Current_Content/January_2024/', 'January_2024'],
        ['2025-01', 'Current_Content/January_2025/', 'January_2025'],
        ['January_2019', 'Current_Content/January_2019/', 'January_2019'],
        ['June_2019', 'Current_Content/June_2019/', 'June_2019'],
        ['December_2019', 'Current_Content/December_2019/', 'December_2019'],
      ])(
        'should create Current_Content structure for month "%s"',
        (month, expectedPrefix, batch) => {
          const result = getContentStructure({ month });

          expect(result.type).toBe('current');
          expect(result.prefix).toBe(expectedPrefix);
          expect(result.batch).toBe(batch);
        },
      );
    });

    describe('with month option - Back Content period', () => {
      it.each([
        [
          '2018-11',
          "Date 2018-11 is in the Back_Content period. Please specify a batch using --batch option. Available batches can be listed with 'biorxiv list' command.",
        ],
        [
          '2018-10',
          "Date 2018-10 is in the Back_Content period. Please specify a batch using --batch option. Available batches can be listed with 'biorxiv list' command.",
        ],
        [
          '2018-01',
          "Date 2018-01 is in the Back_Content period. Please specify a batch using --batch option. Available batches can be listed with 'biorxiv list' command.",
        ],
        [
          '2017-12',
          "Date 2017-12 is in the Back_Content period. Please specify a batch using --batch option. Available batches can be listed with 'biorxiv list' command.",
        ],
        [
          '2015-06',
          "Date 2015-06 is in the Back_Content period. Please specify a batch using --batch option. Available batches can be listed with 'biorxiv list' command.",
        ],
        [
          'November_2018',
          "Date November_2018 is in the Back_Content period. Please specify a batch using --batch option. Available batches can be listed with 'biorxiv list' command.",
        ],
        [
          'October_2018',
          "Date October_2018 is in the Back_Content period. Please specify a batch using --batch option. Available batches can be listed with 'biorxiv list' command.",
        ],
      ])('should throw error for Back_Content period month "%s"', (month, expectedError) => {
        expect(() => getContentStructure({ month })).toThrow(expectedError);
      });
    });

    describe('with invalid inputs', () => {
      it.each([
        [{}, 'Either month or batch must be specified'],
        [{ month: undefined, batch: undefined }, 'Either month or batch must be specified'],
        [{ month: '', batch: '' }, 'Either month or batch must be specified'],
        [
          { month: 'invalid-month' },
          'Invalid month format: invalid-month. Expected YYYY-MM or Month_YYYY format.',
        ],
        [
          { month: '2024-13' },
          'Invalid month format: 2024-13. Expected YYYY-MM or Month_YYYY format.',
        ],
        [
          { month: '2024-00' },
          'Invalid month format: 2024-00. Expected YYYY-MM or Month_YYYY format.',
        ],
        [
          { month: 'InvalidMonth_2024' },
          'Invalid month format: InvalidMonth_2024. Expected YYYY-MM or Month_YYYY format.',
        ],
      ])('should throw error for invalid input %o', (input, expectedError) => {
        expect(() => getContentStructure(input)).toThrow(expectedError);
      });
    });

    describe('edge cases', () => {
      it('should handle December 2018 as Current Content (cutoff date)', () => {
        const result = getContentStructure({ month: '2018-12' });

        expect(result.type).toBe('current');
        expect(result.prefix).toBe('Current_Content/December_2018/');
        expect(result.batch).toBe('December_2018');
      });

      it('should handle January 2019 as Current Content (after cutoff)', () => {
        const result = getContentStructure({ month: '2019-01' });

        expect(result.type).toBe('current');
        expect(result.prefix).toBe('Current_Content/January_2019/');
        expect(result.batch).toBe('January_2019');
      });

      it('should handle November 2018 as Back Content (before cutoff)', () => {
        expect(() => getContentStructure({ month: '2018-11' })).toThrow(
          'Date 2018-11 is in the Back_Content period. Please specify a batch using --batch option.',
        );
      });
    });
  });
});
