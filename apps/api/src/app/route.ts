import { NextResponse } from 'next/server';

export async function GET() {
  const welcomeMessage = {
    message: 'Welcome to openRxiv S3 API',
    version: '1.0.0',
    description:
      'Lightweight API for openRxiv to look up DOI → S3 path lookups (works for bioRxiv and medRxiv)',
    endpoints: {
      health: '/health',
      works: '/v1/works',
      bucket: '/v1/bucket',
      docs: 'https://github.com/continuous-foundation/openrxiv#readme',
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(welcomeMessage);
}
