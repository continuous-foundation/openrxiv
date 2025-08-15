import { NextResponse } from 'next/server';

export function handleZodError(error: any): NextResponse {
  if (error.name === 'ZodError') {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error.issues,
      },
      { status: 400 },
    );
  }

  // Check if it's a validation error from our schema transforms
  if (error instanceof Error && error.message.includes('must be')) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: [{ message: error.message }],
      },
      { status: 400 },
    );
  }

  // Re-throw non-Zod errors to be handled by general error handling
  throw error;
}

export function createErrorResponse(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
