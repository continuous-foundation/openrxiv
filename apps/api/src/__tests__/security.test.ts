import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { apiKeyAuth } from '../utils/auth';
import { withAuth } from '../utils/withAuth';

describe('Security Tests - Direct Function Testing', () => {
  beforeEach(() => {
    process.env.API_KEYS = 'test-key:test-client';
  });

  afterEach(() => {
    delete process.env.API_KEYS;
  });

  describe('apiKeyAuth function', () => {
    it('should reject malformed Bearer token', () => {
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer', // Missing token
        },
      });

      expect(() => apiKeyAuth(request)).toThrow('Authorization header with Bearer token required');
    });

    it('should reject Bearer token with extra spaces', () => {
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer  test-key  ', // Extra spaces
        },
      });

      expect(() => apiKeyAuth(request)).toThrow('Invalid API key');
    });

    it('should reject case-insensitive header manipulation', () => {
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-key', // Lowercase header
        },
      });

      // Should still work as Next.js normalizes headers
      expect(() => apiKeyAuth(request)).not.toThrow(
        'Authorization header with Bearer token required',
      );
    });

    it('should not leak API key information in error messages', () => {
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid-key',
        },
      });

      try {
        apiKeyAuth(request);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toBe('Invalid API key');
          // Ensure no sensitive information is leaked
          expect(error.message).not.toContain('test-key');
          expect(error.message).not.toContain('test-client');
        }
      }
    });

    it('should reject request without Authorization header', () => {
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
      });

      expect(() => apiKeyAuth(request)).toThrow('Authorization header with Bearer token required');
    });

    it('should reject request with invalid Authorization format', () => {
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Basic dGVzdC1rZXk6dGVzdC1jbGllbnQ=', // Basic auth instead of Bearer
        },
      });

      expect(() => apiKeyAuth(request)).toThrow('Authorization header with Bearer token required');
    });

    it('should reject request with empty Bearer token', () => {
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ', // Empty token after Bearer
        },
      });

      expect(() => apiKeyAuth(request)).toThrow('Authorization header with Bearer token required');
    });

    it('should accept valid Bearer token format', () => {
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
        },
      });

      const result = apiKeyAuth(request);
      expect(result).toEqual({
        apiKey: 'test-key',
        clientId: 'test-client',
      });
    });

    it('should handle multiple API keys correctly', () => {
      process.env.API_KEYS = 'key1:client1,key2:client2,key3:client3';

      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer key2',
        },
      });

      const result = apiKeyAuth(request);
      expect(result).toEqual({
        apiKey: 'key2',
        clientId: 'client2',
      });
    });

    it('should handle API keys without client IDs', () => {
      process.env.API_KEYS = 'key1,key2,key3';

      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer key2',
        },
      });

      const result = apiKeyAuth(request);
      expect(result).toEqual({
        apiKey: 'key2',
        clientId: 'unknown',
      });
    });
  });

  describe('withAuth HOF', () => {
    it('should pass authentication to handler when valid', async () => {
      const mockHandler = vi.fn().mockResolvedValue(new Response('OK'));

      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
        },
      });

      await wrappedHandler(request, {});

      expect(mockHandler).toHaveBeenCalledWith(
        request,
        {},
        { apiKey: 'test-key', clientId: 'test-client' },
      );
    });

    it('should return 401 when authentication fails', async () => {
      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid-key',
        },
      });

      const response = await wrappedHandler(request, {});

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const responseBody = await response.json();
      expect(responseBody.error).toBe('Invalid API key');
    });

    it('should return 401 when no authorization header', async () => {
      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/v1/works', {
        method: 'POST',
      });

      const response = await wrappedHandler(request, {});

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const responseBody = await response.json();
      expect(responseBody.error).toBe('Authorization header with Bearer token required');
    });
  });
});
