import { z } from 'zod';

// Schema for listing files by month
export const listFilesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, {
    message: 'Month must be in YYYY-MM format (e.g., 2025-01)',
  }),
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

// Helper function to build pagination links
export function buildPaginationLinks(
  baseURL: string,
  month: string,
  limit: number,
  offset: number,
  totalCount: number,
): Record<string, string> {
  const currentUrl = `${baseURL}/v1/bucket/list?month=${month}&limit=${limit}&offset=${offset}`;

  const links: Record<string, string> = {
    self: currentUrl,
  };

  // Add next page link if there are more files
  if (offset + limit < totalCount) {
    const nextUrl = `${baseURL}/v1/bucket/list?month=${month}&limit=${limit}&offset=${offset + limit}`;
    links.next = nextUrl;
  }

  return links;
}
