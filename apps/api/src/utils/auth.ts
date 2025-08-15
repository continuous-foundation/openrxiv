import type { NextRequest } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  clientId?: string;
}

export function apiKeyAuth(request: NextRequest): { apiKey: string; clientId: string } {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header with Bearer token required');
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

  const validKeys = process.env.API_KEYS?.split(',').map((k) => k.split(':')[0]) || [];

  if (!validKeys.includes(apiKey)) {
    throw new Error('Invalid API key');
  }

  // Extract client ID for logging/auditing
  const clientMapping = process.env.API_KEYS?.split(',').find((k) => k.startsWith(apiKey));
  const clientId = clientMapping?.split(':')[1] || 'unknown';

  // Log the authentication request
  console.log(
    `🔐 API Authentication: Client "${clientId}" using ${request.method} ${request.nextUrl.pathname}`,
  );

  return { apiKey, clientId };
}
