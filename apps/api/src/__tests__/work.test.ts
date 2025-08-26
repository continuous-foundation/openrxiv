import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as worksPost, DELETE as worksDelete, GET as worksGet } from '../app/v1/works/route';
import { GET as workGet } from '../app/v1/works/[doiPrefix]/[doiSuffix]/route';
import { createMockRequest, createMockContext } from './setup';

describe('Work Endpoints - Direct Function Testing', () => {
  beforeEach(() => {
    process.env.API_KEYS = 'test-key:test-client';
  });

  afterEach(async () => {
    delete process.env.API_KEYS;

    // Clean up test data after each test
    const testDOIs = [
      '10.1101/2024.01.15.123456',
      '10.1101/2024.01.15.654321',
      '10.1101/2024.01.15.111111',
      '10.1101/2024.01.15.222222',
    ];

    for (const doi of testDOIs) {
      try {
        const request = createMockRequest('http://localhost:3000/v1/works', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer test-key' },
          searchParams: { doi },
        });
        await worksDelete(request, createMockContext());
      } catch (error) {
        // Ignore errors if work doesn't exist
      }
    }
  });

  describe('POST /v1/works', () => {
    const validWorkData = {
      doi: '10.1101/2024.01.15.123456',
      version: 1,
      receivedDate: '2024-01-15T00:00:00.000Z',
      batch: 'test-batch',
      server: 'biorxiv',
      s3Key: 'test-key',
      fileSize: 1024,
    };

    it('should create work with valid API key', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: validWorkData,
      });

      const response = await worksPost(request, createMockContext());

      // Work might already exist (409) or be created (201)
      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        const body = await response.json();
        expect(body.doi).toBe(validWorkData.doi);
      } else if (response.status === 409) {
        const body = await response.json();
        expect(body.error).toBe('Work already exists');
      }
    });

    it('should reject request without API key', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        body: validWorkData,
      });

      const response = await worksPost(request, createMockContext());

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid API key', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid-key' },
        body: validWorkData,
      });

      const response = await worksPost(request, createMockContext());

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /v1/works', () => {
    it('should delete work by DOI with valid API key', async () => {
      // First create a work to delete
      const workData = {
        doi: '10.1101/2024.01.15.654321',
        version: 1,
        receivedDate: '2024-01-15T00:00:00.000Z',
        batch: 'test-batch',
        server: 'biorxiv',
        s3Key: 'test-key',
        fileSize: 1024,
      };

      const createRequest = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: workData,
      });
      const createResponse = await worksPost(createRequest, createMockContext());

      // Work might already exist, that's fine
      expect([201, 409]).toContain(createResponse.status);

      // Now delete it by DOI
      const deleteRequest = createMockRequest('http://localhost:3000/v1/works', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-key' },
        searchParams: { doi: '10.1101/2024.01.15.654321' },
      });
      const response = await worksDelete(deleteRequest, createMockContext());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('All versions deleted successfully');
      expect(body.doi).toBe('10.1101/2024.01.15.654321');
    });

    it('should reject delete request without API key', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'DELETE',
        searchParams: { doi: '10.1101/2024.01.15.123456' },
      });

      const response = await worksDelete(request, createMockContext());

      expect(response.status).toBe(401);
    });

    it('should reject delete request with invalid API key', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer invalid-key' },
        searchParams: { doi: '10.1101/2024.01.15.123456' },
      });

      const response = await worksDelete(request, createMockContext());

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /v1/works by S3 key', () => {
    it('should delete works by S3 key with valid API key', async () => {
      // First create works with the same S3 key
      const workData1 = {
        doi: '10.1101/2024.01.15.111111',
        version: 1,
        receivedDate: '2024-01-15T00:00:00.000Z',
        batch: 'test-batch',
        server: 'biorxiv',
        s3Key: 'test-s3-key-123',
        fileSize: 1024,
      };

      const workData2 = {
        doi: '10.1101/2024.01.15.222222',
        version: 1,
        receivedDate: '2024-01-15T00:00:00.000Z',
        server: 'biorxiv',
        batch: 'test-batch',
        s3Key: 'test-s3-key-123',
        fileSize: 1024,
      };

      const createRequest1 = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: workData1,
      });
      await worksPost(createRequest1, createMockContext());

      const createRequest2 = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: workData2,
      });
      await worksPost(createRequest2, createMockContext());

      // Now delete by S3 key
      const deleteRequest = createMockRequest('http://localhost:3000/v1/works', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-key' },
        searchParams: { s3Key: 'test-s3-key-123' },
      });
      const response = await worksDelete(deleteRequest, createMockContext());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Works deleted successfully by S3 key');
      expect(body.s3Key).toBe('test-s3-key-123');
      expect(body.worksDeleted).toBe(2);
      expect(body.deletedWorks).toHaveLength(2);
    });

    it('should reject S3 key delete request without API key', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'DELETE',
        searchParams: { s3Key: 'test-s3-key' },
      });

      const response = await worksDelete(request, createMockContext());

      expect(response.status).toBe(401);
    });

    it('should reject S3 key delete request with invalid API key', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer invalid-key' },
        searchParams: { s3Key: 'test-s3-key' },
      });

      const response = await worksDelete(request, createMockContext());

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent S3 key', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-key' },
        searchParams: { s3Key: 'non-existent-key' },
      });

      const response = await worksDelete(request, createMockContext());

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('No works found with the specified S3 key');
    });
  });

  describe('GET /v1/works/:doiPrefix/:doiSuffix', () => {
    it('should allow access without authentication', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works/10.1101/2024.01.15.123456');
      const response = await workGet(request, {
        params: Promise.resolve({ doiPrefix: '10.1101', doiSuffix: '2024.01.15.123456' }),
      });

      // Should not require authentication (may return 404 if no data, but not 401)
      expect(response.status).not.toBe(401);
    });
  });

  describe('GET /v1/works (search endpoint)', () => {
    it('should return search not implemented message', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works', {
        searchParams: { doi: '10.1101/2024.01.15.123456' },
      });

      const response = await worksGet(request);

      expect(response.status).toBe(501);
      const body = await response.json();
      expect(body.error).toBe('Search not implemented');
      expect(body.message).toBe('DOI search endpoint is not implemented');
      expect(body.availableEndpoints).toBeDefined();
    });
  });
});
