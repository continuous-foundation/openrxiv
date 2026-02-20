import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseDOI } from 'openrxiv-utils';
import { createErrorResponse, handleZodError } from '@/utils/zod';
import { getBaseUrl } from '@/utils/getBaseUrl';
import { formatWorkDTO } from '@/dtos/work';
import { validateGetFileByKeyRequest } from '@/utils/bucket';

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
    // Try to handle Zod and validation errors
    try {
      return handleZodError(error);
    } catch {
      // If handleZodError re-throws, it's not a validation error
      console.error('Error fetching work by S3 key:', error);
      return createErrorResponse('Internal server error', 500);
    }
  }
}
