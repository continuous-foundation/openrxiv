import type { Work } from '@prisma/client';
import type { DOIParts } from 'biorxiv-utils';

// Helper function to format work DTO with links
export function formatWorkDTO(baseURL: string, work: Work, parsedDOI: DOIParts): any {
  const baseDOI = parsedDOI.prefix + '/' + parsedDOI.suffix;
  const acceptedDate = work.acceptedDate;
  const versionSuffix = `v${work.version}`;

  const links: Record<string, string> = {
    self: `${baseURL}/v1/works/${baseDOI}${versionSuffix}`,
    html: `https://www.${work.server}.org/content/${baseDOI}${versionSuffix}.full`,
    abstract: `https://www.${work.server}.org/content/${baseDOI}${versionSuffix}`,
    api: `https://api.${work.server}.org/details/${work.server}/${baseDOI}/na/json`,
    pdf: `https://www.${work.server}.org/content/${baseDOI}${versionSuffix}.full.pdf`,
  };

  // Only add JATS URL if acceptedDate exists and is a valid date
  if (acceptedDate && acceptedDate instanceof Date && !isNaN(acceptedDate.getTime())) {
    const year = acceptedDate.getUTCFullYear();
    const month = String(acceptedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(acceptedDate.getUTCDate()).padStart(2, '0');
    links.jats = `https://www.${work.server}.org/content/${work.server}/early/${year}/${month}/${day}/${parsedDOI.suffix}.source.xml`;
  }

  return {
    id: work.id,
    doi: baseDOI,
    version: work.version,
    title: work.title,
    receivedDate: work.receivedDate,
    acceptedDate: work.acceptedDate,
    server: work.server,
    s3Bucket: work.s3Bucket,
    batch: work.batch,
    s3Key: work.s3Key,
    fileSize: Number(work.fileSize),
    links,
  };
}
