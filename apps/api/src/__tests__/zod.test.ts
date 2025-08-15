import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { handleZodError, createErrorResponse } from '../utils/zod';

describe('Zod Utilities - Direct Function Testing', () => {
  describe('handleZodError', () => {
    it('should format Zod validation errors correctly', async () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        age: z.number().min(18, 'Must be at least 18'),
      });

      const invalidData = { name: '', age: 16 };
      const result = schema.safeParse(invalidData);

      if (!result.success) {
        const response = handleZodError(result.error);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toBe('Validation failed');
        expect(body.details).toBeDefined();
        expect(body.details).toHaveLength(2);

        const nameError = body.details.find((e: any) => e.path.includes('name'));
        const ageError = body.details.find((e: any) => e.path.includes('age'));

        expect(nameError?.message).toBe('Name is required');
        expect(ageError?.message).toBe('Must be at least 18');
      }
    });

    it('should handle nested validation errors', async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email('Invalid email'),
          }),
        }),
      });

      const invalidData = { user: { profile: { email: 'not-an-email' } } };
      const result = schema.safeParse(invalidData);

      if (!result.success) {
        const response = handleZodError(result.error);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toBe('Validation failed');
        expect(body.details).toHaveLength(1);
        expect(body.details[0].path).toEqual(['user', 'profile', 'email']);
        expect(body.details[0].message).toBe('Invalid email');
      }
    });

    it('should handle array validation errors', async () => {
      const schema = z.object({
        tags: z.array(z.string().min(1, 'Tag cannot be empty')).min(1, 'At least one tag required'),
      });

      const invalidData = { tags: ['', 'valid-tag'] };
      const result = schema.safeParse(invalidData);

      if (!result.success) {
        const response = handleZodError(result.error);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toBe('Validation failed');
        expect(body.details).toHaveLength(1);
        expect(body.details[0].path).toEqual(['tags', 0]);
        expect(body.details[0].message).toBe('Tag cannot be empty');
      }
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with default status', async () => {
      const response = createErrorResponse('Something went wrong');
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe('Something went wrong');
    });

    it('should create error response with custom status', async () => {
      const response = createErrorResponse('Not found', 404);
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe('Not found');
    });

    it('should handle different error types', async () => {
      const error = new Error('Database connection failed');
      const response = createErrorResponse(error.message, 503);
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.error).toBe('Database connection failed');
    });
  });
});
