import fs from 'fs';
import path from 'path';
import { fromXml } from 'xast-util-from-xml';
import type { Root, Element } from 'xast';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { characterEntities } from 'character-entities';

interface MECAManifest {
  item: Array<{
    '@_id': string;
    '@_type': string;
    '@_title': string;
    instance: Array<{
      '@_media-type': string;
      '@_href': string;
    }>;
  }>;
}

interface PaperData {
  doi: string;
  version: number;
  receivedDate: string;
  acceptedDate?: string;
  batch: string;
  server: string;
  s3Bucket?: string; // Optional since it will be auto-set by the API
  s3Key: string;
  fileSize: number;
  title?: string;
}

export interface ProcessMecaOptions {
  batch: string;
  server: 'biorxiv' | 'medrxiv';
  apiUrl: string;
  output?: string;
  s3Key: string; // Add S3 key parameter
  apiKey?: string; // Add API key for authentication
  selective?: boolean; // Enable selective extraction (manifest + JATS only)
}

export interface ProcessMecaResult {
  success: boolean;
  paper?: any;
  error?: string;
}

/**
 * Process a MECA file and extract metadata
 * @param mecaPath Path to the MECA file (local file path)
 * @param options Processing options
 * @returns ProcessMecaResult with success status and extracted paper data
 */
export async function processMecaFile(
  mecaPath: string,
  options: ProcessMecaOptions,
): Promise<ProcessMecaResult> {
  try {
    console.log(`🔍 Processing MECA file: ${mecaPath}`);

    // Create output directory if specified
    if (options.output && !fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }

    // Extract MECA file (selective or full based on options)
    const extractedDir = options.selective
      ? await extractMecaSelective(mecaPath, options.output || './extracted')
      : await extractMeca(mecaPath, options.output || './extracted');
    console.log(`📂 Extracted to: ${extractedDir}`);

    // Parse manifest
    const manifest = await parseManifest(extractedDir);
    console.log(`📋 Found ${manifest.item.length} items`);

    // Find JATS XML file
    const jatsFile = findJATSFile(manifest, extractedDir);
    if (!jatsFile) {
      throw new Error('No JATS XML file found in manifest');
    }
    console.log(`📄 JATS file found: ${jatsFile}`);

    // Parse JATS XML using unified ecosystem
    console.log(`🔍 Starting JATS parsing...`);
    let jatsData;
    try {
      jatsData = await parseJATS(jatsFile);
      console.log(
        `🔍 JATS parsed - DOI: ${jatsData.doi}, Version: ${jatsData.version}, Received Date: ${jatsData.receivedDate}`,
      );
    } catch (jatsError) {
      console.error('❌ Error parsing JATS:', jatsError);
      throw jatsError;
    }

    // Prepare paper data
    const paperData: PaperData = {
      doi: jatsData.doi,
      version: jatsData.articleVersion,
      receivedDate: new Date(jatsData.receivedDate).toISOString(),
      acceptedDate: jatsData.acceptedDate
        ? new Date(jatsData.acceptedDate).toISOString()
        : undefined,
      batch: options.batch,
      server: options.server,
      s3Key: options.s3Key,
      fileSize: fs.statSync(mecaPath).size,
      title: jatsData.title,
    };

    // Post to API
    const apiResponse = await postToAPI(paperData, options.apiUrl, options.apiKey);
    console.log('✅ Paper added to database');

    return {
      success: true,
      paper: apiResponse,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function extractMeca(mecaPath: string, outputDir: string): Promise<string> {
  const extractedDir = path.join(outputDir, path.basename(mecaPath, path.extname(mecaPath)));

  if (!fs.existsSync(extractedDir)) {
    fs.mkdirSync(extractedDir, { recursive: true });
  }

  // Use adm-zip for ZIP extraction
  const zip = new AdmZip(mecaPath);
  zip.extractAllTo(extractedDir, true);

  return extractedDir;
}

async function extractMecaSelective(mecaPath: string, outputDir: string): Promise<string> {
  const extractedDir = path.join(outputDir, path.basename(mecaPath, path.extname(mecaPath)));

  if (!fs.existsSync(extractedDir)) {
    fs.mkdirSync(extractedDir, { recursive: true });
  }

  console.log('  📦 Using selective extraction (manifest + JATS only)...');

  // Use adm-zip for selective ZIP extraction
  const zip = new AdmZip(mecaPath);

  // First, extract just the manifest to see what's available
  const manifestEntry = zip.getEntry('manifest.xml');
  if (!manifestEntry) {
    throw new Error('Manifest not found in MECA file');
  }

  // Extract manifest
  zip.extractEntryTo('manifest.xml', extractedDir, false, true);
  console.log('  📋 Manifest extracted');

  // Parse manifest to find JATS file path from manifest
  const manifest = await parseManifest(extractedDir);

  // Find the JATS file path from the manifest (without constructing full path yet)
  let jatsRelativePath: string | null = null;
  for (const item of manifest.item) {
    if (item['@_type'] === 'article') {
      for (const instance of item.instance) {
        if (
          instance['@_media-type'] === 'application/xml' &&
          instance['@_href'].endsWith('.xml') &&
          !instance['@_href'].includes('manifest') &&
          !instance['@_href'].includes('directives')
        ) {
          // Normalize path separators to Unix style
          jatsRelativePath = instance['@_href'].replace(/\\/g, '/');
          break;
        }
      }
      if (jatsRelativePath) break;
    }
  }

  if (!jatsRelativePath) {
    throw new Error('No JATS XML file found in manifest');
  }

  console.log(`  📄 Found JATS file in manifest: ${jatsRelativePath}`);

  // Extract the JATS file using the relative path from manifest
  const jatsEntry =
    zip.getEntry(jatsRelativePath) || zip.getEntry(jatsRelativePath.replace(/\//g, '\\'));
  if (jatsEntry) {
    console.log(`  🔍 Extracting JATS file: ${jatsRelativePath} to ${extractedDir}`);

    // Create the target directory structure if it doesn't exist
    const jatsTargetPath = path.join(extractedDir, jatsRelativePath);
    const jatsTargetDir = path.dirname(jatsTargetPath);
    if (!fs.existsSync(jatsTargetDir)) {
      fs.mkdirSync(jatsTargetDir, { recursive: true });
      console.log(`  📁 Created directory: ${jatsTargetDir}`);
    }

    // Extract the JATS file content and write it to the correct location
    const jatsContent = jatsEntry.getData();
    fs.writeFileSync(jatsTargetPath, jatsContent);
    console.log(`  📄 JATS file extracted: ${path.basename(jatsRelativePath)}`);

    // Verify the file was extracted successfully
    console.log(`  🔍 Verifying file exists at: ${jatsTargetPath}`);

    if (!fs.existsSync(jatsTargetPath)) {
      // Debug: list what was actually extracted
      console.log(`  🔍 Debug: Checking extracted directory contents:`);
      const listExtractedFiles = (dir: string, prefix = '') => {
        if (fs.existsSync(dir)) {
          const items = fs.readdirSync(dir);
          items.forEach((item) => {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
              console.log(`    ${prefix}📁 ${item}/`);
              listExtractedFiles(itemPath, prefix + '  ');
            } else {
              console.log(`    ${prefix}📄 ${item}`);
            }
          });
        }
      };
      listExtractedFiles(extractedDir);

      throw new Error(`JATS file was not extracted successfully to: ${jatsTargetPath}`);
    }

    console.log(`  ✅ JATS file verified at: ${jatsTargetPath}`);
  } else {
    throw new Error(`Could not extract JATS file: ${jatsRelativePath}`);
  }

  return extractedDir;
}

async function parseManifest(extractedDir: string): Promise<MECAManifest> {
  const manifestPath = path.join(extractedDir, 'manifest.xml');

  if (!fs.existsSync(manifestPath)) {
    throw new Error('Manifest file not found');
  }

  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');

  // Use xast-util-from-xml to parse the manifest XML
  const ast = fromXml(manifestContent);

  // Parse the manifest structure
  return parseManifestStructure(ast);
}

function parseManifestStructure(ast: Root): MECAManifest {
  // Navigate through the AST to find manifest content
  const manifest = findElement(ast, 'manifest');
  if (!manifest) {
    throw new Error('Manifest element not found');
  }

  const items = findElements(manifest, 'item');
  const itemData = items.map((item) => {
    const id = getAttribute(item, 'id');
    const type = getAttribute(item, 'type');
    const title = getTextContent(item);

    const instances = findElements(item, 'instance');
    const instanceData = instances.map((instance) => {
      const mediaType = getAttribute(instance, 'media-type');
      const href = getAttribute(instance, 'href');

      return {
        '@_media-type': mediaType || '',
        '@_href': href || '',
      };
    });

    return {
      '@_id': id || '',
      '@_type': type || '',
      '@_title': title || '',
      instance: instanceData,
    };
  });

  return {
    item: itemData,
  };
}

function findJATSFile(manifest: MECAManifest, extractedDir: string): string | null {
  for (const item of manifest.item) {
    if (item['@_type'] === 'article') {
      for (const instance of item.instance) {
        if (
          instance['@_media-type'] === 'application/xml' &&
          instance['@_href'].endsWith('.xml') &&
          !instance['@_href'].includes('manifest') &&
          !instance['@_href'].includes('directives')
        ) {
          // Normalize path separators to Unix style
          const normalizedPath = instance['@_href'].replace(/\\/g, '/');
          return path.join(extractedDir, normalizedPath);
        }
      }
    }
  }
  return null;
}

async function parseJATS(jatsFile: string): Promise<{
  doi: string;
  version: string;
  articleVersion: number;
  receivedDate: string;
  acceptedDate?: string;
  title?: string;
}> {
  let jatsContent = fs.readFileSync(jatsFile, 'utf-8');

  // Preprocess XML content to fix common HTML entities
  jatsContent = preprocessXMLContent(jatsContent);

  // Use xast-util-from-xml for JATS parsing
  const ast = fromXml(jatsContent);

  // Extract metadata from the parsed JATS AST
  const doi = extractDOI(ast);
  const versionInfo = extractVersion(ast);
  const dates = extractDates(ast);
  const title = extractTitle(ast);

  return {
    doi,
    version: versionInfo.version,
    articleVersion: versionInfo.articleVersion,
    receivedDate: dates.receivedDate,
    acceptedDate: dates.acceptedDate,
    title,
  };
}

/**
 * Preprocess XML content to fix common HTML entities that cause parsing errors
 * @param xmlContent Raw XML content
 * @returns Preprocessed XML content with entities replaced
 */
export function preprocessXMLContent(xmlContent: string): string {
  // Define all valid HTML entities that we recognize
  const validEntities = Object.keys(characterEntities);
  // First, escape any unescaped ampersands that cause "Unterminated reference" errors
  // This handles cases like "Bill & Melinda" where & is not properly escaped
  const validEntityPattern = validEntities.join('|');
  let processedContent = xmlContent.replace(
    new RegExp(`&(?!(?:${validEntityPattern}|#\\d+);)`, 'g'),
    '&#38;',
  );

  // Now replace HTML entities with their Unicode equivalents
  // This handles cases like &ndash;, &lt;, etc.
  // Note: We do NOT convert &amp; to & to avoid circular problems
  const entityReplacements: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(characterEntities).map(([key, value]) => [`&${key};`, value]),
    ),
    '&lt;': '&#60;', // less than
    '&gt;': '&#62;', // greater than
    '&amp;': '&#38;', // ampersand
  };

  // Replace HTML entities
  for (const [entity, replacement] of Object.entries(entityReplacements)) {
    processedContent = processedContent.replace(new RegExp(entity, 'g'), replacement);
  }

  return processedContent;
}

// Helper functions to navigate the XAST
function findElement(node: Root | Element, name: string): Element | null {
  if (node.type === 'element' && node.name === name) {
    return node;
  }

  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'element') {
        const found = findElement(child, name);
        if (found) return found;
      }
    }
  }

  return null;
}

function findElements(node: Root | Element, name: string): Element[] {
  const results: Element[] = [];

  if (node.type === 'element' && node.name === name) {
    results.push(node);
  }

  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'element') {
        results.push(...findElements(child, name));
      }
    }
  }

  return results;
}

function getAttribute(node: Element, name: string): string | null {
  if (node.attributes && node.attributes[name]) {
    const value = node.attributes[name];
    return value ? String(value) : null;
  }
  return null;
}

function extractDOI(ast: Root): string {
  // Look for article-id with pub-id-type="doi"
  const articleIds = findElements(ast, 'article-id');

  for (const id of articleIds) {
    const pubIdType = getAttribute(id, 'pub-id-type');
    if (pubIdType === 'doi') {
      // Get the text content
      const textContent = getTextContent(id);
      if (textContent) {
        return textContent.trim();
      }
    }
  }

  throw new Error('DOI not found in JATS XML');
}

function extractVersion(ast: Root): { version: string; articleVersion: number } {
  // Look for article-version
  const versionElement = findElement(ast, 'article-version');
  if (versionElement) {
    const textContent = getTextContent(versionElement);
    if (textContent) {
      const version = textContent.trim();
      // Extract the version number from strings like "1.4" -> articleVersion = 4
      const versionParts = version.split('.');
      const articleVersion = versionParts.length > 1 ? parseInt(versionParts[1]) : 1;
      return { version, articleVersion };
    }
  }

  return { version: '1.1', articleVersion: 1 }; // Default version
}

function extractDates(ast: Root): { receivedDate: string; acceptedDate?: string } {
  let receivedDate: string | undefined;
  let acceptedDate: string | undefined;

  // Look for dates in history section
  const history = findElement(ast, 'history');
  if (history) {
    const dates = findElements(history, 'date');
    for (const date of dates) {
      const dateType = getAttribute(date, 'date-type');
      const yearElement = findElement(date, 'year');
      const monthElement = findElement(date, 'month');
      const dayElement = findElement(date, 'day');

      if (yearElement && monthElement && dayElement) {
        const year = getTextContent(yearElement);
        const month = getTextContent(monthElement);
        const day = getTextContent(dayElement);

        if (year && month && day) {
          const dateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          if (dateType === 'received') {
            receivedDate = dateString;
          } else if (dateType === 'accepted') {
            acceptedDate = dateString;
          }
        }
      }
    }
  }

  // Fallback: look for pub-date with pub-type="epub" (bioRxiv format)
  if (!receivedDate) {
    const pubDates = findElements(ast, 'pub-date');
    for (const date of pubDates) {
      const pubType = getAttribute(date, 'pub-type');
      if (pubType === 'epub') {
        const yearElement = findElement(date, 'year');
        const monthElement = findElement(date, 'month');
        const dayElement = findElement(date, 'day');

        if (yearElement && monthElement && dayElement) {
          const year = getTextContent(yearElement);
          const month = getTextContent(monthElement);
          const day = getTextContent(dayElement);

          if (year && month && day) {
            receivedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            break;
          }
        }
      }
    }
  }

  if (!receivedDate) {
    throw new Error('Received date not found in JATS XML');
  }

  return { receivedDate, acceptedDate };
}

function extractTitle(ast: Root): string | undefined {
  // Look for article-title
  const titleElement = findElement(ast, 'article-title');
  if (titleElement) {
    const textContent = getTextContent(titleElement);
    if (textContent) {
      return textContent.trim();
    }
  }

  return undefined;
}

function getTextContent(node: Element): string | null {
  if (node.children) {
    let text = '';
    for (const child of node.children) {
      if (child.type === 'text' && child.value) {
        text += child.value;
      } else if (child.type === 'element' && child.children) {
        const childText = getTextContent(child);
        if (childText) {
          text += childText;
        }
      }
    }
    return text || null;
  }

  return null;
}

async function postToAPI(paperData: PaperData, apiUrl: string, apiKey?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await axios.post(`${apiUrl}/v1/works`, paperData, { headers });
  return response.data;
}
