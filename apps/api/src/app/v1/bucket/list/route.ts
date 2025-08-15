import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type { Work } from '@prisma/client';
import { createErrorResponse } from '@/utils/zod';
import { getBaseUrl } from '@/utils/getBaseUrl';
import { validateListFilesRequest, convertMonthFormat, buildPaginationLinks } from '@/utils/bucket';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    const { month, limit = 100, offset } = validateListFilesRequest(query);

    // Convert YYYY-MM to Month_YYYY format
    const batchName = convertMonthFormat(month);

    // Get total count for pagination info
    const totalCount = await prisma.work.count({
      where: {
        batch: batchName,
      },
    });

    // Find works for the specified month with pagination
    const works = (await prisma.work.findMany({
      where: {
        batch: batchName,
      },
      take: limit,
      skip: offset,
      orderBy: {
        receivedDate: 'desc',
      },
      select: {
        doi: true,
        version: true,
        title: true,
        receivedDate: true,
        acceptedDate: true,
        batch: true,
        server: true,
        s3Bucket: true,
        s3Key: true,
        fileSize: true,
      },
    })) as Work[];

    // Format the response
    const files = works.map((work) => ({
      doi: work.doi,
      version: work.version,
      title: work.title,
      receivedDate: work.receivedDate,
      acceptedDate: work.acceptedDate,
      batch: work.batch,
      server: work.server,
      s3Bucket: work.s3Bucket,
      s3Key: work.s3Key,
      fileSize: Number(work.fileSize),
    }));

    // Build pagination links
    const links = buildPaginationLinks(getBaseUrl(request), month, limit, offset, totalCount);

    return NextResponse.json({
      month,
      batch: batchName,
      pagination: {
        total: totalCount,
        limit: limit,
        offset: offset,
        hasMore: offset + limit < totalCount,
        nextOffset: offset + limit < totalCount ? offset + limit : null,
      },
      files,
      links,
    });
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
    console.error('Error listing files by month:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
