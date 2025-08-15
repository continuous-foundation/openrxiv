import { NextResponse } from 'next/server';

function getAvailableEndpoints() {
  return {
    error: 'Endpoint not found',
    message: 'The requested API endpoint does not exist',
    availableEndpoints: {
      root: '/',
      health: '/health',
      works: '/v1/works',
      'works-by-doi': '/v1/works/[doiPrefix]/[doiSuffix]',
      bucket: '/v1/bucket',
      'bucket-list': '/v1/bucket/list',
    },
    timestamp: new Date().toISOString(),
  };
}

export async function GET() {
  return NextResponse.json(getAvailableEndpoints(), { status: 404 });
}

export async function POST() {
  return NextResponse.json(getAvailableEndpoints(), { status: 404 });
}

export async function PUT() {
  return NextResponse.json(getAvailableEndpoints(), { status: 404 });
}

export async function DELETE() {
  return NextResponse.json(getAvailableEndpoints(), { status: 404 });
}
