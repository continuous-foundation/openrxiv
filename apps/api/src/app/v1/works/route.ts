import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type { DOIParts } from 'openrxiv-utils';
import { parseDOI, isValidBiorxivDOI, extractBaseDOI, extractVersion } from 'openrxiv-utils';
import { withAuth } from '@/utils/withAuth';
import { createErrorResponse, handleZodError } from '@/utils/zod';
import { getBaseUrl } from '@/utils/getBaseUrl';
import { formatWorkDTO } from '@/dtos/work';
import {
  validateCreateWorkRequest,
  validateDeleteRequest,
  deleteByS3Key,
  deleteVersion,
  deleteWorkByDoi,
} from '@/utils/works';

const prisma = new PrismaClient();

// GET endpoint for works search (not implemented)
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Search not implemented',
      message: 'DOI search endpoint is not yet implemented',
      availableEndpoints: {
        'get-by-doi': '/v1/works/[doiPrefix]/[doiSuffix]',
        'create-work': 'POST /v1/works',
        'delete-work': 'DELETE /v1/works',
      },
      note: 'Use /v1/works/[doiPrefix]/[doiSuffix] to get a specific work by DOI',
      timestamp: new Date().toISOString(),
    },
    { status: 501 },
  );
}

// Protected POST endpoint for creating works
export const POST = withAuth(
  async (request: NextRequest, context: any, auth: { apiKey: string; clientId: string }) => {
    try {
      const body = await request.json();
      const workData = validateCreateWorkRequest(body);

      // Check if work already exists
      const existingWork = await prisma.work.findFirst({
        where: {
          doi: workData.doi,
          version: workData.version,
        },
      });

      if (existingWork) {
        return NextResponse.json(
          {
            error: 'Work already exists',
            doi: workData.doi,
            version: workData.version,
          },
          { status: 409 },
        );
      }

      // Auto-set S3 bucket based on server
      const s3Bucket =
        workData.server === 'medrxiv' ? 'medrxiv-src-monthly' : 'biorxiv-src-monthly';

      // Create the work
      const work = await prisma.work.create({
        data: {
          doi: workData.doi,
          version: workData.version,
          receivedDate: new Date(workData.receivedDate),
          acceptedDate: workData.acceptedDate ? new Date(workData.acceptedDate) : null,
          batch: workData.batch,
          server: workData.server,
          s3Bucket,
          s3Key: workData.s3Key,
          fileSize: BigInt(workData.fileSize),
          title: workData.title,
        },
      });

      // Log the successful creation
      console.log(`Work creation request from client: ${auth.clientId}`, {
        doi: workData.doi,
        timestamp: new Date().toISOString(),
        clientId: auth.clientId,
      });

      const dto = formatWorkDTO(getBaseUrl(request), work, parseDOI(work.doi) as DOIParts);

      return NextResponse.json(dto, { status: 201 });
    } catch (error) {
      // Try to handle Zod and validation errors
      try {
        return handleZodError(error);
      } catch {
        // If handleZodError re-throws, it's not a validation error
        console.error('Error creating work:', error);
        return createErrorResponse('Internal server error', 500);
      }
    }
  },
);

// Protected DELETE endpoint for deleting works
export const DELETE = withAuth(
  async (request: NextRequest, context: any, auth: { apiKey: string; clientId: string }) => {
    try {
      const { searchParams } = new URL(request.url);
      const query = Object.fromEntries(searchParams.entries());

      // Validate the query parameters using Zod
      const validatedQuery = validateDeleteRequest(query);

      // Handle S3 key-based deletion
      if ('s3Key' in validatedQuery) {
        try {
          const result = await deleteByS3Key(
            validatedQuery.s3Key,
            prisma,
            auth.clientId,
            getBaseUrl(request),
          );
          return NextResponse.json({
            message: 'Works deleted successfully by S3 key',
            s3Key: validatedQuery.s3Key,
            worksDeleted: result.worksDeleted,
            deletedWorks: result.deletedWorks,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'No works found with the specified S3 key'
          ) {
            return NextResponse.json(
              { error: error.message, s3Key: validatedQuery.s3Key },
              { status: 404 },
            );
          } else {
            throw error;
          }
        }
      }

      // Handle DOI-based deletion
      if ('doi' in validatedQuery) {
        const doi = validatedQuery.doi;

        // Validate DOI format
        if (!isValidBiorxivDOI(doi)) {
          return NextResponse.json(
            {
              error: 'Invalid bioRxiv DOI format',
              doi: doi,
              expectedFormat: '10.1101/YYYY.MM.DD.identifier',
            },
            { status: 400 },
          );
        }

        // Parse DOI to extract components
        const parsedDOI = parseDOI(doi);
        if (!parsedDOI) {
          return NextResponse.json({ error: 'Could not parse DOI', doi: doi }, { status: 400 });
        }

        const baseDOI = extractBaseDOI(doi);
        const extractedVersion = extractVersion(doi);
        const versionNumber = extractedVersion ? parseInt(extractedVersion.replace('v', '')) : null;

        if (extractedVersion) {
          // Delete specific version
          if (!versionNumber) {
            return NextResponse.json(
              { error: 'Invalid version format', doi: doi, version: extractedVersion },
              { status: 400 },
            );
          }

          try {
            const result = await deleteVersion(baseDOI, versionNumber, prisma, auth.clientId);
            return NextResponse.json({
              message: 'Work deleted successfully',
              doi: result.doi,
              version: result.version,
            });
          } catch (error) {
            if (error instanceof Error && error.message === 'Work not found') {
              return NextResponse.json(
                { error: error.message, doi: doi, version: extractedVersion },
                { status: 404 },
              );
            } else {
              throw error;
            }
          }
        } else {
          // Delete all versions of the DOI
          try {
            const result = await deleteWorkByDoi(baseDOI, prisma, auth.clientId);
            return NextResponse.json({
              message: 'All versions deleted successfully',
              doi: result.doi,
              versionsDeleted: result.versionsDeleted,
            });
          } catch (error) {
            if (error instanceof Error && error.message === 'No works found') {
              return NextResponse.json({ error: error.message, doi: baseDOI }, { status: 404 });
            } else {
              throw error;
            }
          }
        }
      }

      // If we reach here, no valid deletion method was found
      return NextResponse.json(
        { error: 'Invalid deletion request - must provide either doi or s3Key parameter' },
        { status: 400 },
      );
    } catch (error) {
      // Try to handle Zod and validation errors
      try {
        return handleZodError(error);
      } catch {
        // If handleZodError re-throws, it's not a validation error
        console.error('Error deleting work:', error);
        return createErrorResponse('Internal server error', 500);
      }
    }
  },
);
