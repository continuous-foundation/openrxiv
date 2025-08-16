import { describe, it, expect } from 'vitest';
import { getContentStructure, normalizeBatch } from './content-structure.js';

describe('Content Structure Utilities', () => {
  describe('normalizeBatch', () => {
    describe('bioRxiv server (default)', () => {
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
      ])('should normalize "%s" to "%s" for bioRxiv', (input, expected) => {
        expect(normalizeBatch(input, 'biorxiv')).toBe(expected);
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
      ])('should throw error for invalid input "%s" for bioRxiv', (input, expectedError) => {
        expect(() => normalizeBatch(input, 'biorxiv')).toThrow(expectedError);
      });

      it.each([
        [0, 'Invalid batch format: 0. Expected a positive number or batch identifier.'],
        [-1, 'Invalid batch format: -1. Expected a positive number or batch identifier.'],
        [-100, 'Invalid batch format: -100. Expected a positive number or batch identifier.'],
      ])('should throw error for invalid number input %d for bioRxiv', (input, expectedError) => {
        expect(() => normalizeBatch(input, 'biorxiv')).toThrow(expectedError);
      });
    });

    describe('medRxiv server', () => {
      it.each([
        // Number inputs
        [1, 'medRxiv_Batch_01'],
        [5, 'medRxiv_Batch_05'],
        [10, 'medRxiv_Batch_10'],
        [25, 'medRxiv_Batch_25'],
        [100, 'medRxiv_Batch_100'],

        // String inputs with various formats
        ['1', 'medRxiv_Batch_01'],
        ['5', 'medRxiv_Batch_05'],
        ['10', 'medRxiv_Batch_10'],
        ['01', 'medRxiv_Batch_01'],
        ['05', 'medRxiv_Batch_05'],

        // With "batch" prefix
        ['batch1', 'medRxiv_Batch_01'],
        ['batch-1', 'medRxiv_Batch_01'],
        ['batch_1', 'medRxiv_Batch_01'],
        ['Batch1', 'medRxiv_Batch_01'],
        ['BATCH-1', 'medRxiv_Batch_01'],
        ['BATCH_1', 'medRxiv_Batch_01'],

        // With "medrxiv" prefix
        ['medrxiv-batch1', 'medRxiv_Batch_01'],
        ['medrxiv-batch-1', 'medRxiv_Batch_01'],
        ['medrxiv_batch_1', 'medRxiv_Batch_01'],
        ['MedRxiv-Batch1', 'medRxiv_Batch_01'],
        ['MEDRXIV-BATCH-1', 'medRxiv_Batch_01'],
        ['MEDRXIV_BATCH_1', 'medRxiv_Batch_01'],

        // With leading zeros
        ['001', 'medRxiv_Batch_01'],
        ['005', 'medRxiv_Batch_05'],
        ['010', 'medRxiv_Batch_10'],
        ['batch001', 'medRxiv_Batch_01'],
        ['batch-001', 'medRxiv_Batch_01'],
        ['batch_001', 'medRxiv_Batch_01'],
        ['medrxiv-batch001', 'medRxiv_Batch_01'],
        ['medrxiv-batch-001', 'medRxiv_Batch_01'],
        ['medrxiv_batch_001', 'medRxiv_Batch_01'],

        // Edge cases
        ['batch-01', 'medRxiv_Batch_01'],
        ['batch_01', 'medRxiv_Batch_01'],
        ['Batch_01', 'medRxiv_Batch_01'],
        ['BATCH_01', 'medRxiv_Batch_01'],
        ['medrxiv-batch-01', 'medRxiv_Batch_01'],
        ['medrxiv_batch_01', 'medRxiv_Batch_01'],
        ['MedRxiv_Batch_01', 'medRxiv_Batch_01'],
        ['MEDRXIV_BATCH_01', 'medRxiv_Batch_01'],
      ])('should normalize "%s" to "%s" for medRxiv', (input, expected) => {
        expect(normalizeBatch(input, 'medrxiv')).toBe(expected);
      });

      it.each([
        ['0', 'Invalid batch format: 0. Expected a positive number or batch identifier.'],
        ['-1', 'Invalid batch format: -1. Expected a positive number or batch identifier.'],
        ['abc', 'Invalid batch format: abc. Expected a positive number or batch identifier.'],
        [
          'batch-abc',
          'Invalid batch format: batch-abc. Expected a positive number or batch identifier.',
        ],
        [
          'medrxiv-batch-abc',
          'Invalid batch format: medrxiv-batch-abc. Expected a positive number or batch identifier.',
        ],
        ['', 'Invalid batch format: . Expected a positive number or batch identifier.'],
        ['batch-', 'Invalid batch format: batch-. Expected a positive number or batch identifier.'],
        ['batch_', 'Invalid batch format: batch_. Expected a positive number or batch identifier.'],
        [
          'medrxiv-batch-',
          'Invalid batch format: medrxiv-batch-. Expected a positive number or batch identifier.',
        ],
        [
          'medrxiv_batch_',
          'Invalid batch format: medrxiv_batch_. Expected a positive number or batch identifier.',
        ],
      ])('should throw error for invalid input "%s" for medRxiv', (input, expectedError) => {
        expect(() => normalizeBatch(input, 'medrxiv')).toThrow(expectedError);
      });

      it.each([
        [0, 'Invalid batch format: 0. Expected a positive number or batch identifier.'],
        [-1, 'Invalid batch format: -1. Expected a positive number or batch identifier.'],
        [-100, 'Invalid batch format: -100. Expected a positive number or batch identifier.'],
      ])('should throw error for invalid number input %d for medRxiv', (input, expectedError) => {
        expect(() => normalizeBatch(input, 'medrxiv')).toThrow(expectedError);
      });
    });

    describe('default behavior (no server specified)', () => {
      it('should default to bioRxiv format when no server specified', () => {
        expect(normalizeBatch(1)).toBe('Batch_01');
        expect(normalizeBatch('5')).toBe('Batch_05');
        expect(normalizeBatch('batch-10')).toBe('Batch_10');
      });
    });

    describe('case insensitive server names', () => {
      it('should handle case insensitive server names', () => {
        expect(normalizeBatch(1, 'BIORXIV')).toBe('Batch_01');
        expect(normalizeBatch(1, 'BioRxiv')).toBe('Batch_01');
        expect(normalizeBatch(1, 'MEDRXIV')).toBe('medRxiv_Batch_01');
        expect(normalizeBatch(1, 'MedRxiv')).toBe('medRxiv_Batch_01');
      });
    });
  });

  describe('getContentStructure', () => {
    describe('with batch option', () => {
      describe('bioRxiv server', () => {
        it.each([
          ['1', 'Back_Content/Batch_01/'],
          ['5', 'Back_Content/Batch_05/'],
          ['10', 'Back_Content/Batch_10/'],
          ['batch1', 'Back_Content/Batch_01/'],
          ['batch-1', 'Back_Content/Batch_01/'],
          ['batch_1', 'Back_Content/Batch_01/'],
          ['Batch_01', 'Back_Content/Batch_01/'],
          ['BATCH_01', 'Back_Content/Batch_01/'],
        ])(
          'should create Back_Content structure for batch "%s" on bioRxiv',
          (batch, expectedPrefix) => {
            const result = getContentStructure({ batch, server: 'biorxiv' });

            expect(result.type).toBe('back');
            expect(result.prefix).toBe(expectedPrefix);
            expect(result.batch).toBe(`Batch_${batch.replace(/\D/g, '').padStart(2, '0')}`);
          },
        );
      });

      describe('medRxiv server', () => {
        it.each([
          ['1', 'Back_Content/medRxiv_Batch_01/'],
          ['5', 'Back_Content/medRxiv_Batch_05/'],
          ['10', 'Back_Content/medRxiv_Batch_10/'],
          ['batch1', 'Back_Content/medRxiv_Batch_01/'],
          ['batch-1', 'Back_Content/medRxiv_Batch_01/'],
          ['batch_1', 'Back_Content/medRxiv_Batch_01/'],
          ['medrxiv-batch1', 'Back_Content/medRxiv_Batch_01/'],
          ['medrxiv-batch-1', 'Back_Content/medRxiv_Batch_01/'],
          ['medrxiv_batch_1', 'Back_Content/medRxiv_Batch_01/'],
          ['MedRxiv_Batch_01', 'Back_Content/medRxiv_Batch_01/'],
        ])(
          'should create Back_Content structure for batch "%s" on medRxiv',
          (batch, expectedPrefix) => {
            const result = getContentStructure({ batch, server: 'medrxiv' });

            expect(result.type).toBe('back');
            expect(result.prefix).toBe(expectedPrefix);
            expect(result.batch).toBe(`medRxiv_Batch_${batch.replace(/\D/g, '').padStart(2, '0')}`);
          },
        );
      });

      describe('default server (bioRxiv)', () => {
        it.each([
          ['1', 'Back_Content/Batch_01/'],
          ['5', 'Back_Content/Batch_05/'],
          ['10', 'Back_Content/Batch_10/'],
        ])(
          'should create Back_Content structure for batch "%s" with default server',
          (batch, expectedPrefix) => {
            const result = getContentStructure({ batch });

            expect(result.type).toBe('back');
            expect(result.prefix).toBe(expectedPrefix);
            expect(result.batch).toBe(`Batch_${batch.replace(/\D/g, '').padStart(2, '0')}`);
          },
        );
      });
    });

    describe('with month option - Current Content period', () => {
      describe('bioRxiv server', () => {
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
          'should create Current_Content structure for month "%s" on bioRxiv',
          (month, expectedPrefix, batch) => {
            const result = getContentStructure({ month, server: 'biorxiv' });

            expect(result.type).toBe('current');
            expect(result.prefix).toBe(expectedPrefix);
            expect(result.batch).toBe(batch);
          },
        );
      });

      describe('medRxiv server', () => {
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
          'should create Current_Content structure for month "%s" on medRxiv',
          (month, expectedPrefix, batch) => {
            const result = getContentStructure({ month, server: 'medrxiv' });

            expect(result.type).toBe('current');
            expect(result.prefix).toBe(expectedPrefix);
            expect(result.batch).toBe(batch);
          },
        );
      });

      describe('default server (bioRxiv)', () => {
        it.each([
          ['2019-01', 'Current_Content/January_2019/', 'January_2019'],
          ['2024-01', 'Current_Content/January_2024/', 'January_2024'],
        ])(
          'should create Current_Content structure for month "%s" with default server',
          (month, expectedPrefix, batch) => {
            const result = getContentStructure({ month });

            expect(result.type).toBe('current');
            expect(result.prefix).toBe(expectedPrefix);
            expect(result.batch).toBe(batch);
          },
        );
      });
    });

    describe('with month option - Back Content period', () => {
      describe('bioRxiv server', () => {
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
        ])(
          'should throw error for Back_Content period month "%s" on bioRxiv',
          (month, expectedError) => {
            expect(() => getContentStructure({ month, server: 'biorxiv' })).toThrow(expectedError);
          },
        );
      });

      describe('medRxiv server', () => {
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
        ])(
          'should throw error for Back_Content period month "%s" on medRxiv',
          (month, expectedError) => {
            expect(() => getContentStructure({ month, server: 'medrxiv' })).toThrow(expectedError);
          },
        );
      });

      describe('default server (bioRxiv)', () => {
        it.each([
          [
            '2018-11',
            "Date 2018-11 is in the Back_Content period. Please specify a batch using --batch option. Available batches can be listed with 'biorxiv list' command.",
          ],
        ])(
          'should throw error for Back_Content period month "%s" with default server',
          (month, expectedError) => {
            expect(() => getContentStructure({ month })).toThrow(expectedError);
          },
        );
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
      describe('bioRxiv server', () => {
        it('should handle December 2018 as Current Content (cutoff date)', () => {
          const result = getContentStructure({ month: '2018-12', server: 'biorxiv' });

          expect(result.type).toBe('current');
          expect(result.prefix).toBe('Current_Content/December_2018/');
          expect(result.batch).toBe('December_2018');
        });

        it('should handle January 2019 as Current Content (after cutoff)', () => {
          const result = getContentStructure({ month: '2019-01', server: 'biorxiv' });

          expect(result.type).toBe('current');
          expect(result.prefix).toBe('Current_Content/January_2019/');
          expect(result.batch).toBe('January_2019');
        });

        it('should handle November 2018 as Back Content (before cutoff)', () => {
          expect(() => getContentStructure({ month: '2018-11', server: 'biorxiv' })).toThrow(
            'Date 2018-11 is in the Back_Content period. Please specify a batch using --batch option.',
          );
        });
      });

      describe('medRxiv server', () => {
        it('should handle December 2018 as Current Content (cutoff date)', () => {
          const result = getContentStructure({ month: '2018-12', server: 'medrxiv' });

          expect(result.type).toBe('current');
          expect(result.prefix).toBe('Current_Content/December_2018/');
          expect(result.batch).toBe('December_2018');
        });

        it('should handle January 2019 as Current Content (after cutoff)', () => {
          const result = getContentStructure({ month: '2019-01', server: 'medrxiv' });

          expect(result.type).toBe('current');
          expect(result.prefix).toBe('Current_Content/January_2019/');
          expect(result.batch).toBe('January_2019');
        });

        it('should handle November 2018 as Back Content (before cutoff)', () => {
          expect(() => getContentStructure({ month: '2018-11', server: 'medrxiv' })).toThrow(
            'Date 2018-11 is in the Back_Content period. Please specify a batch using --batch option.',
          );
        });
      });

      describe('default server (bioRxiv)', () => {
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

    describe('server validation', () => {
      it('should not allow both month and batch to be specified', () => {
        expect(() => getContentStructure({ month: '2024-01', batch: '1' })).toThrow(
          'Either month or batch must be specified, not both',
        );
        expect(() =>
          getContentStructure({ month: '2024-01', batch: '1', server: 'medrxiv' }),
        ).toThrow('Either month or batch must be specified, not both');
      });

      it('should require either month or batch', () => {
        expect(() => getContentStructure({ server: 'biorxiv' })).toThrow(
          'Either month or batch must be specified',
        );
        expect(() => getContentStructure({ server: 'medrxiv' })).toThrow(
          'Either month or batch must be specified',
        );
      });
    });
  });
});
