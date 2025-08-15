import type { NextRequest } from 'next/server';

export function getBaseUrl(request: NextRequest): string {
  return request.nextUrl.origin;
}
