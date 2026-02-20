import { z } from 'zod';
import type { DOIParts } from 'openrxiv-utils';
import { parseDOI, BIORXIV_DOI_PREFIX_PATTERN } from 'openrxiv-utils';
import { formatWorkDTO } from '@/dtos/work';

// Zod validation schema for creating works
export const createWorkSchema = z.object({
  doi: z
    .string()
    .regex(
      new RegExp(`^${BIORXIV_DOI_PREFIX_PATTERN}/(\\d{4}\\.\\d{2}\\.\\d{2}\\.)?\\d{6,8}(v\\d+)?$`),
      {
        message:
          'DOI must be in bioRxiv format: 10.1101 or 10.64898/YYYY.MM.DD.XXXXXX or /XXXXXX (legacy)',
      },
    ),
  version: z.number().int().positive('Version must be a positive integer'),
  receivedDate: z.iso.datetime({ message: 'Received date must be a valid ISO datetime string' }),
  acceptedDate: z.iso
    .datetime({ message: 'Accepted date must be a valid ISO datetime string' })
    .optional(),
  batch: z.string().min(1, 'Batch is required'),
  server: z.enum(['biorxiv', 'medrxiv']),
  license: z.string().optional(),
  s3Key: z.string().min(1, 'S3 key is required'),
  fileSize: z.number().int().positive('File size must be a positive integer'),
  title: z.string().optional(),
});

export type CreateWorkRequest = z.infer<typeof createWorkSchema>;

// Zod validation schemas for delete requests
export const deleteByDoiSchema = z.object({
  doi: z
    .string()
    .regex(
      new RegExp(`^${BIORXIV_DOI_PREFIX_PATTERN}/(\\d{4}\\.\\d{2}\\.\\d{2}\\.)?\\d{6,8}(v\\d+)?$`),
      {
        message:
          'DOI must be in bioRxiv format: 10.1101 or 10.64898/YYYY.MM.DD.XXXXXX or /XXXXXX (legacy)',
      },
    ),
});

export const deleteByS3KeySchema = z.object({
  s3Key: z.string().min(1, 'S3 key is required'),
});

export const deleteRequestSchema = z.union([deleteByDoiSchema, deleteByS3KeySchema]).refine(
  (data) => {
    // Ensure at least one of doi or s3Key is provided
    return 'doi' in data || 's3Key' in data;
  },
  {
    message: 'Either DOI or S3 key query parameter is required',
  },
);

export type DeleteRequest = z.infer<typeof deleteRequestSchema>;

// Validation function for creating works
export function validateCreateWorkRequest(body: any): CreateWorkRequest {
  return createWorkSchema.parse(body);
}

// Validation function for delete requests
export function validateDeleteRequest(query: any): DeleteRequest {
  return deleteRequestSchema.parse(query);
}

// Helper function to delete works by S3 key
export async function deleteByS3Key(
  s3Key: string,
  prisma: any,
  clientId: string,
  baseURL: string,
): Promise<{ worksDeleted: number; deletedWorks: any[] }> {
  // Find works with the given S3 key
  const works = await prisma.work.findMany({
    where: { s3Key: s3Key },
  });

  if (works.length === 0) {
    throw new Error('No works found with the specified S3 key');
  }

  // Delete all works with the given S3 key
  await prisma.work.deleteMany({
    where: { s3Key: s3Key },
  });

  // Log the deletion
  console.log(`🗑️ S3 Key deletion request from client: ${clientId}`, {
    s3Key: s3Key,
    worksDeleted: works.length,
    timestamp: new Date().toISOString(),
    clientId: clientId,
  });

  return {
    worksDeleted: works.length,
    deletedWorks: works.map((work: any) =>
      formatWorkDTO(baseURL, work, parseDOI(work.doi) as DOIParts),
    ),
  };
}

// Helper function to delete a specific version of a work
export async function deleteVersion(
  baseDOI: string,
  versionNumber: number,
  prisma: any,
  clientId: string,
): Promise<{ doi: string; version: number }> {
  const work = await prisma.work.findFirst({
    where: { doi: baseDOI, version: versionNumber },
  });

  if (!work) {
    throw new Error('Work not found');
  }

  // Delete the work
  await prisma.work.delete({
    where: { id: work.id },
  });

  // Log the deletion
  console.log(`🗑️ Work deletion request from client: ${clientId}`, {
    doi: `${baseDOI}v${versionNumber}`,
    version: versionNumber,
    timestamp: new Date().toISOString(),
    clientId: clientId,
  });

  return { doi: baseDOI, version: versionNumber };
}

// Helper function to delete all versions of a work by DOI
export async function deleteWorkByDoi(
  baseDOI: string,
  prisma: any,
  clientId: string,
): Promise<{ doi: string; versionsDeleted: number }> {
  const works = await prisma.work.findMany({
    where: { doi: baseDOI },
  });

  if (works.length === 0) {
    throw new Error('No works found');
  }

  // Delete all versions
  await prisma.work.deleteMany({
    where: { doi: baseDOI },
  });

  // Log the deletion
  console.log(`🗑️ Work deletion request from client: ${clientId}`, {
    doi: baseDOI,
    versionsDeleted: works.length,
    timestamp: new Date().toISOString(),
    clientId: clientId,
  });

  return { doi: baseDOI, versionsDeleted: works.length };
}
