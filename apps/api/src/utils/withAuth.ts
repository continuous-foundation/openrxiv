import type { NextRequest, NextResponse } from 'next/server';
import { apiKeyAuth } from '@/utils/auth';
import { createErrorResponse } from '@/utils/zod';

export function withAuth(
  handler: (
    request: NextRequest,
    context: any,
    auth: { apiKey: string; clientId: string },
  ) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    try {
      const auth = apiKeyAuth(request);
      return await handler(request, context, auth);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('Authorization header') ||
          error.message.includes('Invalid API key')
        ) {
          return createErrorResponse(error.message, 401);
        }
      }
      return createErrorResponse('Authentication failed', 401);
    }
  };
}
