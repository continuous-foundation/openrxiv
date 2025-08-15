import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parseDOI } from 'biorxiv-utils';
import { createErrorResponse } from '@/utils/zod';
import { getBaseUrl } from '@/utils/getBaseUrl';
import { formatWorkDTO } from '@/dtos/work';
import { validateGetFileByKeyRequest } from '@/utils/bucket';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    const { key } = validateGetFileByKeyRequest(query);

    const work = await prisma.work.findFirst({
      where: { s3Key: key },
    });

    if (!work) {
      return NextResponse.json({ error: 'Work not found', s3Key: key }, { status: 404 });
    }

    const parsedDOI = parseDOI(work.doi);
    if (!parsedDOI) {
      return NextResponse.json({ error: 'Work not found', s3Key: key }, { status: 404 });
    }

    const formattedWork = formatWorkDTO(getBaseUrl(request), work, parsedDOI);

    return NextResponse.json(formattedWork);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: (error as any).issues,
        },
        { status: 400 },
      );
    }
    console.error('Error fetching work by S3 key:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
