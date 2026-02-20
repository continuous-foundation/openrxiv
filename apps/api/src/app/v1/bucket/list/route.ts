import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Work } from '@prisma/client';
import { createErrorResponse, handleZodError } from '@/utils/zod';
import { getBaseUrl } from '@/utils/getBaseUrl';
import {
  validateListFilesRequest,
  getBatchNameForLookup,
  buildPaginationLinks,
} from '@/utils/bucket';
import { formatWorkDTO } from '@/dtos/work';
import type { DOIParts } from 'openrxiv-utils';
import { parseDOI } from 'openrxiv-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    const { server, folder, limit = 100, offset } = validateListFilesRequest(query);

    // Get the batch name for database lookup (handles both month and batch formats)
    const batchName = getBatchNameForLookup(server, folder);

    // Get total count for pagination info
    const totalCount = await prisma.work.count({
      where: {
        server,
        batch: batchName,
      },
    });

    // Find works for the specified folder with pagination
    const works = (await prisma.work.findMany({
      where: {
        server,
        batch: batchName,
      },
      take: limit,
      skip: offset,
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
    const items = works.map((work) => {
      const versionSuffix = `v${work.version}`;
      const versionDoi = `${work.doi}${versionSuffix}`;
      return formatWorkDTO(getBaseUrl(request), work, parseDOI(versionDoi) as DOIParts);
    });

    // Build pagination links
    const links = buildPaginationLinks(getBaseUrl(request), batchName, limit, offset, totalCount);

    return NextResponse.json({
      server,
      folder: batchName,
      pagination: {
        total: totalCount,
        limit: limit,
        offset: offset,
        hasMore: offset + limit < totalCount,
        nextOffset: offset + limit < totalCount ? offset + limit : null,
      },
      items,
      links,
    });
  } catch (error) {
    // Try to handle Zod and validation errors
    try {
      return handleZodError(error);
    } catch {
      // If handleZodError re-throws, it's not a validation error
      console.error('Error listing files by folder:', error);
      return createErrorResponse('Internal server error', 500);
    }
  }
}
