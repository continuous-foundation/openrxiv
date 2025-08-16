/**
 * Parse batch input to support ranges like "1-10" or "batch-1,batch-2"
 */
export function parseBatchInput(batchInput: string): string[] {
  // Check if it's a comma-separated list first
  if (batchInput.includes(',')) {
    const parts = batchInput
      .split(',')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const allBatches: string[] = [];

    for (const part of parts) {
      // Check if this part is a range
      const rangeMatch = part.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);

        if (start > end) {
          throw new Error(
            `Invalid batch range: start (${start}) cannot be greater than end (${end})`,
          );
        }

        if (end - start >= 100) {
          throw new Error(
            `Batch range too large: ${end - start + 1} batches. Maximum allowed: 100`,
          );
        }

        for (let i = start; i <= end; i++) {
          allBatches.push(i.toString());
        }
      } else {
        // Single batch
        allBatches.push(part);
      }
    }

    return allBatches;
  }

  // Check if it's a single range (e.g., "1-10")
  const rangeMatch = batchInput.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);

    if (start > end) {
      throw new Error(`Invalid batch range: start (${start}) cannot be greater than end (${end})`);
    }

    if (end - start >= 100) {
      throw new Error(`Batch range too large: ${end - start + 1} batches. Maximum allowed: 100`);
    }

    const batches: string[] = [];
    for (let i = start; i <= end; i++) {
      batches.push(i.toString());
    }
    return batches;
  }

  // Single batch
  return [batchInput];
}

/**
 * Validate batch format
 */
export function validateBatchFormat(batch: string): boolean {
  // Allow numeric batches (1, 2, 3) or named batches (batch-1, Batch_01, etc.)
  return /^[\w\-_]+$/.test(batch);
}
