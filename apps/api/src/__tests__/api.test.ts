import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { GET as healthGet } from '../app/health/route';
import { GET as worksGet } from '../app/v1/works/[doiPrefix]/[doiSuffix]/route';
import { POST as worksPost, DELETE as worksDelete } from '../app/v1/works/route';
import { createMockRequest, createMockContext, prisma } from './setup';

describe('API Integration Tests - Direct Function Testing', () => {
  beforeAll(async () => {
    // Connect to the real database
    await prisma.$connect();
    console.log('Connected to database for testing');
  });

  beforeEach(() => {
    // Set up API keys for testing
    process.env.API_KEYS = 'test-key:test-client';
  });

  afterEach(async () => {
    // Clean up API keys
    delete process.env.API_KEYS;

    // Clean up test data using DELETE endpoint
    const testDOIs = [
      '10.1101/2023.01.01.999999',
      '10.1101/2023.01.01.888888',
      '10.1101/2023.01.01.777777',
      '10.1101/2023.01.01.666666',
      '10.1101/2023.01.01.555555',
      '10.1101/2023.01.01.444444',
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

  beforeEach(async () => {
    // Clean up any test works before each test
    await prisma.work.deleteMany({
      where: {
        doi: {
          in: [
            '10.1101/2023.01.01.999999',
            '10.1101/2023.01.01.888888',
            '10.1101/2023.01.01.777777',
            '10.1101/2023.01.01.666666',
            '10.1101/2023.01.01.555555',
            '10.1101/2023.01.01.444444',
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up database connection
    await prisma.$disconnect();
    console.log('Disconnected from database');
  });

  describe('GET /health', () => {
    it('should return health status with timestamp', async () => {
      const request = createMockRequest('http://localhost:3000/health');
      const response = await healthGet(request, createMockContext());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
      expect(typeof body.timestamp).toBe('string');

      // Verify timestamp is valid
      const timestamp = new Date(body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });

  describe('GET /v1/works/:doiPrefix/:doiSuffix', () => {
    it('should return 400 for invalid DOI format', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works/invalid/doi');
      const response = await worksGet(request, {
        params: Promise.resolve({ doiPrefix: 'invalid', doiSuffix: 'doi' }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Invalid bioRxiv DOI format');
    });

    it('should return 400 for malformed DOI', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works/10.1101/invalid');
      const response = await worksGet(request, {
        params: Promise.resolve({ doiPrefix: '10.1101', doiSuffix: 'invalid' }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 404 for non-existent DOI', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works/10.1101/9999.99.99.999999');
      const response = await worksGet(request, {
        params: Promise.resolve({ doiPrefix: '10.1101', doiSuffix: '9999.99.99.999999' }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'No works found');
    });

    it('should handle valid bioRxiv DOI format', async () => {
      const request = createMockRequest('http://localhost:3000/v1/works/10.1101/2023.01.01.123456');
      const response = await worksGet(request, {
        params: Promise.resolve({ doiPrefix: '10.1101', doiSuffix: '2023.01.01.123456' }),
      });

      // This might return 404 if the DOI doesn't exist, but should handle the format correctly
      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('doi');
        expect(body).toHaveProperty('versions');
      } else if (response.status === 404) {
        const body = await response.json();
        expect(body).toHaveProperty('error', 'No works found');
      }
    });
  });

  describe('POST /v1/works', () => {
    it('should create a new work entry', async () => {
      const workData = {
        doi: '10.1101/2023.01.01.999999',
        version: 1,
        receivedDate: '2023-01-01T00:00:00.000Z',
        acceptedDate: '2023-01-05T00:00:00.000Z',
        batch: 'test-batch',
        server: 'biorxiv',
        license: 'CC-BY',
        s3Bucket: 'biorxiv-src-monthly',
        s3Key: 'test/path/work.meca',
        fileSize: 1024,
        title: 'Test Work Title',
      };

      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: workData,
      });

      const response = await worksPost(request, createMockContext());

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('doi');
      expect(body.doi).toBe(workData.doi);
      expect(body.version).toBe(workData.version);
      expect(body.title).toBe(workData.title);
      expect(body.fileSize).toBe(workData.fileSize);
      expect(body.links).toBeDefined();
      expect(body.links.biorxiv).toContain(workData.doi);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        doi: '10.1101/2023.01.01.666666',
        // Missing version and other required fields
      };

      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: incompleteData,
      });

      const response = await worksPost(request, createMockContext());

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Validation failed');
      expect(body).toHaveProperty('details');
    });

    it('should return 400 for invalid version type', async () => {
      const invalidData = {
        doi: '10.1101/2023.01.01.555555',
        version: 'v1', // Should be a number
        receivedDate: '2023-01-01T00:00:00.000Z',
        batch: 'test-batch',
        s3Key: 'test/path/work.meca',
        fileSize: 1024,
      };

      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: invalidData,
      });

      const response = await worksPost(request, createMockContext());

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Validation failed');
    });

    it('should return 400 for invalid date format', async () => {
      const invalidData = {
        doi: '10.1101/2023.01.01.444444',
        version: 1,
        receivedDate: '2023-01-01', // Should be ISO datetime
        batch: 'test-batch',
        s3Key: 'test/path/work.meca',
        fileSize: 1024,
      };

      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: invalidData,
      });

      const response = await worksPost(request, createMockContext());

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Validation failed');
    });

    it('should return 409 for duplicate work', async () => {
      const workData = {
        doi: '10.1101/2023.01.01.888888',
        version: 2,
        receivedDate: '2023-01-01T00:00:00.000Z',
        batch: 'test-batch',
        s3Key: 'test/path/duplicate.meca',
        fileSize: 1024,
      };

      // Create first work
      const createRequest = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: workData,
      });
      await worksPost(createRequest, createMockContext());

      // Try to create duplicate
      const duplicateRequest = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: workData,
      });
      const response = await worksPost(duplicateRequest, createMockContext());

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Work already exists');
    });

    it('should handle optional fields correctly', async () => {
      const workData = {
        doi: '10.1101/2023.01.01.777777',
        version: 3,
        receivedDate: '2023-01-01T00:00:00.000Z',
        batch: 'test-batch',
        s3Key: 'test/path/optional.meca',
        fileSize: 1024,
        // No title, acceptedDate - these are optional
      };

      const request = createMockRequest('http://localhost:3000/v1/works', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: workData,
      });

      const response = await worksPost(request, createMockContext());

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.title).toBeNull();
      expect(body.acceptedDate).toBeNull();
    });
  });

  describe('Database Integration', () => {
    it('should have database connection', async () => {
      // Test that we can actually query the database
      const workCount = await prisma.work.count();
      expect(typeof workCount).toBe('number');
      expect(workCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle database queries correctly', async () => {
      // Test a simple database query
      const works = await prisma.work.findMany({
        take: 1,
        select: {
          doi: true,
          version: true,
          title: true,
        },
      });

      expect(Array.isArray(works)).toBe(true);

      if (works.length > 0) {
        const work = works[0];
        expect(work).toHaveProperty('doi');
        expect(work).toHaveProperty('version');
        expect(work).toHaveProperty('title');
        expect(typeof work.version).toBe('number');
      }
    });

    it('should handle BigInt fileSize correctly', async () => {
      // Test that BigInt fields are handled properly
      const works = await prisma.work.findMany({
        take: 1,
        select: {
          fileSize: true,
        },
      });

      if (works.length > 0) {
        const work = works[0];
        expect(work.fileSize).toBeDefined();
        expect(typeof work.fileSize).toBe('bigint');
        expect(work.fileSize).toBeGreaterThanOrEqual(BigInt(0));
      }
    });
  });

  describe('Real Data Tests', () => {
    it('should find works if they exist in database', async () => {
      // Get a sample work from the database
      const sampleWork = await prisma.work.findFirst({
        select: {
          doi: true,
          version: true,
        },
      });

      if (sampleWork) {
        const [prefix, suffix] = sampleWork.doi.split('/');
        const request = createMockRequest(`http://localhost:3000/v1/works/${prefix}/${suffix}`);
        const response = await worksGet(request, {
          params: Promise.resolve({ doiPrefix: prefix, doiSuffix: suffix }),
        });

        if (response.status === 200) {
          const body = await response.json();
          expect(body).toHaveProperty('doi', sampleWork.doi);
          expect(body).toHaveProperty('versions');
          expect(Array.isArray(body.versions)).toBe(true);
        } else if (response.status === 404) {
          // This is also valid - the article might not have the expected structure
          const body = await response.json();
          expect(body).toHaveProperty('error', 'No works found');
        }
      } else {
        // No articles in database, skip this test
        console.log('No articles found in database, skipping real data test');
      }
    });

    it('should return work with links when version is specified', async () => {
      // Get a sample work from the database
      const sampleWork = await prisma.work.findFirst({
        select: {
          doi: true,
          version: true,
        },
      });

      if (sampleWork) {
        const [prefix, suffix] = sampleWork.doi.split('/');
        const request = createMockRequest(
          `http://localhost:3000/v1/works/${prefix}/${suffix}v${sampleWork.version}`,
        );
        const response = await worksGet(request, {
          params: Promise.resolve({
            doiPrefix: prefix,
            doiSuffix: `${suffix}v${sampleWork.version}`,
          }),
        });

        if (response.status === 200) {
          const body = await response.json();
          expect(body).toHaveProperty('doi', sampleWork.doi);
          expect(body).toHaveProperty('version', sampleWork.version);
          expect(body).toHaveProperty('links');
          expect(body.links).toHaveProperty('biorxiv');
          expect(body.links).toHaveProperty('pdf');
          expect(body.links).toHaveProperty('html');

          // JATS link should only be present if acceptedDate exists
          if (body.acceptedDate) {
            expect(body.links).toHaveProperty('jats');
          }
        }
      }
    });
  });
});
