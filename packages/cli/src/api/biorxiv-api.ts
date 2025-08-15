/**
 * BioRxiv API Client
 * Provides access to bioRxiv and medRxiv APIs for fetching preprint metadata
 */

export interface BiorxivContentDetail {
  doi: string;
  title: string;
  authors: string;
  author_corresponding: string;
  author_corresponding_institution: string;
  date: string;
  version: string;
  type: string;
  license: string;
  category: string;
  jats_xml_path: string;
  abstract: string;
  funding: FundingInfo[];
  published: string;
  server: 'biorxiv' | 'medrxiv';
}

export interface FundingInfo {
  name: string;
  id: string;
  'id-type': string;
  award: string;
}

export interface BiorxivApiResponse {
  collection: BiorxivContentDetail[];
  messages: ApiMessage[];
}

export interface ApiMessage {
  cursor: number;
  count: number;
  total: number;
  limit: number;
  offset: number;
}

export interface BiorxivApiOptions {
  format?: 'json' | 'xml' | 'html';
  server?: 'biorxiv' | 'medrxiv';
  timeout?: number;
}

export class BiorxivApiClient {
  private baseUrl = 'https://api.biorxiv.org';
  private defaultTimeout = 10000; // 10 seconds

  constructor(private options: BiorxivApiOptions = {}) {
    this.options = {
      format: 'json',
      server: 'biorxiv',
      timeout: this.defaultTimeout,
      ...options,
    };
  }

  /**
   * Get content details for a specific DOI
   * Endpoint: /details/[server]/[DOI]/na/[format]
   * Note: The API expects base DOIs without version numbers
   */
  async getContentDetail(
    doi: string,
    options?: Partial<BiorxivApiOptions>,
  ): Promise<BiorxivContentDetail | null> {
    const opts = { ...this.options, ...options };
    const server = opts.server || 'biorxiv';
    const format = opts.format || 'json';

    try {
      // Remove version number from DOI for API query
      const baseDOI = doi.replace(/v\d+$/, '');
      // Don't encode the DOI - the API expects literal forward slashes
      const url = `${this.baseUrl}/details/${server}/${baseDOI}/na/${format}`;
      console.log(`🔍 Fetching content details from: ${url}`);

      const response = await this.makeRequest(url, opts.timeout);

      if (!response) {
        return null;
      }

      // Parse response based on format
      let data: BiorxivApiResponse;
      if (format === 'json') {
        data = response as BiorxivApiResponse;
      } else {
        // For XML/HTML, we'd need to parse differently
        throw new Error(`Format ${format} not yet implemented`);
      }

      // Return the first (and should be only) item in the collection
      if (data.collection && data.collection.length > 0) {
        return data.collection[0];
      }

      return null;
    } catch (error) {
      console.error(`❌ Error fetching content details for DOI ${doi}:`, error);
      throw new Error(
        `Failed to fetch content details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get content details for multiple DOIs
   */
  async getContentDetails(
    dois: string[],
    options?: Partial<BiorxivApiOptions>,
  ): Promise<(BiorxivContentDetail | null)[]> {
    const results = await Promise.allSettled(
      dois.map((doi) => this.getContentDetail(doi, options)),
    );

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error('Failed to fetch DOI:', result.reason);
        return null;
      }
    });
  }

  /**
   * Get all versions of a preprint
   * This is useful for versioned preprints where the API returns multiple versions
   */
  async getAllVersions(
    doi: string,
    options?: Partial<BiorxivApiOptions>,
  ): Promise<BiorxivContentDetail[]> {
    const opts = { ...this.options, ...options };
    const server = opts.server || 'biorxiv';
    const format = opts.format || 'json';

    try {
      // Remove version number from DOI for API query
      const baseDOI = doi.replace(/v\d+$/, '');
      // Don't encode the DOI - the API expects literal forward slashes
      const url = `${this.baseUrl}/details/${server}/${baseDOI}/na/${format}`;
      console.log(`🔍 Fetching all versions from: ${url}`);

      const response = await this.makeRequest(url, opts.timeout);

      if (!response) {
        return [];
      }

      // Parse response based on format
      let data: BiorxivApiResponse;
      if (format === 'json') {
        data = response as BiorxivApiResponse;
      } else {
        // For XML/HTML, we'd need to parse differently
        throw new Error(`Format ${format} not yet implemented`);
      }

      // Return all versions in the collection
      if (data.collection && data.collection.length > 0) {
        return data.collection;
      }

      return [];
    } catch (error) {
      console.error(`❌ Error fetching all versions for DOI ${doi}:`, error);
      throw new Error(
        `Failed to fetch all versions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get content details for a date range
   * Endpoint: /details/[server]/[start_date]/[end_date]/[cursor]
   */
  async getContentDetailsByDateRange(
    startDate: string,
    endDate: string,
    cursor: number = 0,
    options?: Partial<BiorxivApiOptions>,
  ): Promise<BiorxivApiResponse | null> {
    const opts = { ...this.options, ...options };
    const server = opts.server || 'biorxiv';
    const format = opts.format || 'json';

    try {
      const url = `${this.baseUrl}/details/${server}/${startDate}/${endDate}/${cursor}/${format}`;
      console.log(`🔍 Fetching content details for date range: ${startDate} to ${endDate}`);

      const response = await this.makeRequest(url, opts.timeout);

      if (!response) {
        return null;
      }

      return response as BiorxivApiResponse;
    } catch (error) {
      console.error(`❌ Error fetching content details for date range:`, error);
      throw new Error(
        `Failed to fetch content details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get content details for recent posts
   * Endpoint: /details/[server]/[count]/[cursor]
   */
  async getRecentContentDetails(
    count: number,
    cursor: number = 0,
    options?: Partial<BiorxivApiOptions>,
  ): Promise<BiorxivApiResponse | null> {
    const opts = { ...this.options, ...options };
    const server = opts.server || 'biorxiv';
    const format = opts.format || 'json';

    try {
      const url = `${this.baseUrl}/details/${server}/${count}/${cursor}/${format}`;
      console.log(`🔍 Fetching ${count} recent content details`);

      const response = await this.makeRequest(url, opts.timeout);

      if (!response) {
        return null;
      }

      return response as BiorxivApiResponse;
    } catch (error) {
      console.error(`❌ Error fetching recent content details:`, error);
      throw new Error(
        `Failed to fetch recent content details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get content details for recent days
   * Endpoint: /details/[server]/[days]d/[cursor]
   */
  async getContentDetailsByDays(
    days: number,
    cursor: number = 0,
    options?: Partial<BiorxivApiOptions>,
  ): Promise<BiorxivApiResponse | null> {
    const opts = { ...this.options, ...options };
    const server = opts.server || 'biorxiv';
    const format = opts.format || 'json';

    try {
      const url = `${this.baseUrl}/details/${server}/${days}d/${cursor}/${format}`;
      console.log(`🔍 Fetching content details for last ${days} days`);

      const response = await this.makeRequest(url, opts.timeout);

      if (!response) {
        return null;
      }

      return response as BiorxivApiResponse;
    } catch (error) {
      console.error(`❌ Error fetching content details for days:`, error);
      throw new Error(
        `Failed to fetch content details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get content details with subject category filter
   */
  async getContentDetailsByCategory(
    startDate: string,
    endDate: string,
    category: string,
    cursor: number = 0,
    options?: Partial<BiorxivApiOptions>,
  ): Promise<BiorxivApiResponse | null> {
    const opts = { ...this.options, ...options };
    const server = opts.server || 'biorxiv';
    const format = opts.format || 'json';

    try {
      // Encode category (replace spaces with underscores or URL encode)
      const encodedCategory = category.replace(/\s+/g, '_');
      const url = `${this.baseUrl}/details/${server}/${startDate}/${endDate}/${cursor}/${format}?category=${encodedCategory}`;
      console.log(`🔍 Fetching content details for category: ${category}`);

      const response = await this.makeRequest(url, opts.timeout);

      if (!response) {
        return null;
      }

      return response as BiorxivApiResponse;
    } catch (error) {
      console.error(`❌ Error fetching content details for category:`, error);
      throw new Error(
        `Failed to fetch content details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async makeRequest(url: string, timeout?: number): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || this.defaultTimeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'biorxiv-meca-downloader/1.0.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`📭 No content found for the requested DOI`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  /**
   * Check if the API is accessible
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/details/biorxiv/1/0/json`);
      return response !== null;
    } catch (error) {
      console.error('❌ API ping failed:', error);
      return false;
    }
  }

  /**
   * Get API rate limit information from response headers
   */
  private getRateLimitInfo(response: Response): { remaining?: number; reset?: Date } {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    return {
      remaining: remaining ? parseInt(remaining, 10) : undefined,
      reset: reset ? new Date(parseInt(reset, 10) * 1000) : undefined,
    };
  }
}

/**
 * Utility function to create a bioRxiv API client
 */
export function createBiorxivApiClient(options?: BiorxivApiOptions): BiorxivApiClient {
  return new BiorxivApiClient(options);
}

/**
 * Utility function to extract server from DOI
 */
export function getServerFromDOI(doi: string): 'biorxiv' | 'medrxiv' {
  // This is a simple heuristic - in practice, you might want to check both servers
  // or use additional metadata to determine the correct server
  if (doi.includes('medrxiv') || doi.includes('med')) {
    return 'medrxiv';
  }
  return 'biorxiv';
}
