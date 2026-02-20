import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

// Test utilities for Next.js API testing
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    searchParams?: Record<string, string>;
  } = {},
): NextRequest {
  const { method = 'GET', headers = {}, body, searchParams = {} } = options;

  // Build URL with search params
  const urlObj = new URL(url);
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  const requestInit: Omit<RequestInit, 'signal'> = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(urlObj.toString(), requestInit);
}

export function createMockContext() {
  return {};
}

// Database setup for integration tests
export { prisma };

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
  console.log('Connected to test database');
});

afterAll(async () => {
  // Disconnect from test database
  await prisma.$disconnect();
  console.log('Disconnected from test database');
});

beforeEach(async () => {
  // Set up test environment
  process.env.API_KEYS = 'test-key:test-client';

  // Clean up test data
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

afterEach(async () => {
  // Clean up test environment
  delete process.env.API_KEYS;

  // Clean up test data
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
