import { z } from 'zod';
import type { FolderStructure } from 'biorxiv-utils';
import { normalizeMonthToYYYYMM, normalizeBatch, getFolderStructure } from 'biorxiv-utils';

// Schema for listing files by folder (month or batch)
export const listFilesSchema = z.object({
  folder: z.string().min(1, 'Folder parameter is required (month or batch)'),
  server: z.enum(['biorxiv', 'medrxiv']).default('biorxiv'),
  limit: z
    .string()
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        throw new Error('Limit must be a positive integer');
      }
      if (num > 1000) {
        throw new Error('Limit must be 1000 or less');
      }
      return num;
    })
    .optional(),
  offset: z
    .string()
    .default('0')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0) {
        throw new Error('Offset must be a non-negative integer');
      }
      return num;
    }),
});

// Schema for getting file by S3 key
export const getFileByKeySchema = z.object({
  key: z.string().min(1, 'S3 key is required'),
});

// Type for the validated request
export type ListFilesRequest = z.infer<typeof listFilesSchema>;
export type GetFileByKeyRequest = z.infer<typeof getFileByKeySchema>;

// Validation function for list files endpoint
export function validateListFilesRequest(query: any): ListFilesRequest {
  return listFilesSchema.parse(query);
}

// Validation function for get file by key endpoint
export function validateGetFileByKeyRequest(query: any): GetFileByKeyRequest {
  return getFileByKeySchema.parse(query);
}

// Helper function to determine folder type and normalize it
export function parseFolderParameter(
  server: 'biorxiv' | 'medrxiv',
  folder: string,
): FolderStructure {
  // First check if it's a month format
  const normalizedMonth = normalizeMonthToYYYYMM(folder);
  if (normalizedMonth) {
    return getFolderStructure({ server, month: normalizedMonth });
  }

  // If not a month, try to normalize as a batch
  try {
    const normalizedBatch = normalizeBatch(folder);
    return getFolderStructure({ server, batch: normalizedBatch });
  } catch (error) {
    throw new Error(
      `Invalid folder format: ${folder}. Folder must be as a month (YYYY-MM or Month_YYYY) or batch format (Batch_NN or medRxiv_Batch_NN or NN).`,
    );
  }
}

// Helper function to convert YYYY-MM to Month_YYYY format
export function convertMonthFormat(month: string): string {
  const [year, monthNum] = month.split('-');
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthName = monthNames[parseInt(monthNum, 10) - 1];
  return `${monthName}_${year}`;
}

// Helper function to get the batch name for database lookup
export function getBatchNameForLookup(server: 'biorxiv' | 'medrxiv', folder: string): string {
  const { batch } = parseFolderParameter(server, folder);
  return batch;
}

// Helper function to build pagination links
export function buildPaginationLinks(
  baseURL: string,
  folder: string,
  limit: number,
  offset: number,
  totalCount: number,
): Record<string, string> {
  const currentUrl = `${baseURL}/v1/bucket/list?folder=${encodeURIComponent(folder)}&limit=${limit}&offset=${offset}`;

  const links: Record<string, string> = {
    self: currentUrl,
  };

  // Add next page link if there are more files
  if (offset + limit < totalCount) {
    const nextUrl = `${baseURL}/v1/bucket/list?folder=${encodeURIComponent(folder)}&limit=${limit}&offset=${offset + limit}`;
    links.next = nextUrl;
  }

  return links;
}
