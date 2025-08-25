import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type { DOIParts } from 'openrxiv-utils';
import { parseDOI } from 'openrxiv-utils';
import { createErrorResponse } from '@/utils/zod';
import { getBaseUrl } from '@/utils/getBaseUrl';
import { parseAndValidateDOI } from '@/utils/work';
import { formatWorkDTO } from '@/dtos/work';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ doiPrefix: string; doiSuffix: string }> },
) {
  const baseURL = getBaseUrl(request);

  try {
    const { doiPrefix, doiSuffix } = await params;

    const parsedDOI = parseAndValidateDOI(doiPrefix, doiSuffix);
    if (!parsedDOI.isValid) {
      if (parsedDOI.error === 'Invalid bioRxiv DOI format') {
        return NextResponse.json(
          {
            error: parsedDOI.error,
            doi: parsedDOI.fullDOI,
            expectedFormat: '10.1101/YYYY.MM.DD.identifier',
          },
          { status: 400 },
        );
      } else {
        return NextResponse.json(
          {
            error: parsedDOI.error,
            doi: parsedDOI.fullDOI,
          },
          { status: 400 },
        );
      }
    }

    if (parsedDOI.version) {
      // Get specific version
      const work = await prisma.work.findFirst({
        where: { doi: parsedDOI.baseDOI, version: parsedDOI.versionNumber! },
      });

      if (!work) {
        return NextResponse.json(
          {
            error: 'Work not found',
            doi: parsedDOI.fullDOI,
            version: parsedDOI.version,
          },
          { status: 404 },
        );
      }

      // Format work with links using the helper function
      const dto = formatWorkDTO(baseURL, work, parseDOI(parsedDOI.fullDOI) as DOIParts);
      return NextResponse.json(dto);
    } else {
      // Get all versions
      const works = await prisma.work.findMany({
        where: { doi: parsedDOI.baseDOI },
        orderBy: { version: 'asc' },
      });

      if (works.length === 0) {
        return NextResponse.json(
          {
            error: 'No works found',
            doi: parsedDOI.baseDOI,
          },
          { status: 404 },
        );
      }

      // Format each work using the shared formatter
      const formattedWorks = works.map((work) => {
        const versionSuffix = `v${work.version}`;
        const versionDoi = `${parsedDOI.baseDOI}${versionSuffix}`;
        return formatWorkDTO(baseURL, work, parseDOI(versionDoi) as DOIParts);
      });

      return NextResponse.json({ doi: parsedDOI.baseDOI, versions: formattedWorks });
    }
  } catch (error) {
    console.error('Error fetching work:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
