import { NextResponse } from 'next/server';

export async function GET() {
  const welcomeMessage = {
    message: 'Welcome to bioRxiv S3 API',
    version: '1.0.0',
    description: 'Lightweight API for bioRxiv DOI → S3 path lookups',
    endpoints: {
      health: '/health',
      works: '/v1/works',
      bucket: '/v1/bucket',
      docs: 'https://github.com/continuous-foundation/biorxiv#readme',
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(welcomeMessage);
}
