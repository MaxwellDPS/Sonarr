export interface SonarrApiOptions {
  baseUrl: string;
  apiKey: string;
}

interface DownloadClientField {
  name: string;
  value: unknown;
  [key: string]: unknown;
}

interface DownloadClientResource {
  id?: number;
  name: string;
  implementation: string;
  implementationName?: string;
  configContract: string;
  enable: boolean;
  protocol: string;
  priority: number;
  tags: number[];
  fields: DownloadClientField[];
  [key: string]: unknown;
}

interface QueueItem {
  id: number;
  title: string;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages?: Array<{ title: string; messages: string[] }>;
  downloadId?: string;
  [key: string]: unknown;
}

interface QueueResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: QueueItem[];
}

interface Series {
  id?: number;
  title: string;
  tvdbId: number;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored: boolean;
  seasonFolder: boolean;
  seasons: Array<{ seasonNumber: number; monitored: boolean }>;
  [key: string]: unknown;
}

export class SonarrApi {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: SonarrApiOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Sonarr API ${method} ${path} failed with ${response.status}: ${text}`
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return (await response.json()) as T;
    }
    return undefined as T;
  }

  // System
  async getSystemStatus(): Promise<{ version: string; [key: string]: unknown }> {
    return this.request('GET', '/api/v3/system/status');
  }

  // Download Clients
  async getDownloadClientSchemas(): Promise<DownloadClientResource[]> {
    return this.request('GET', '/api/v3/downloadclient/schema');
  }

  async getSeedrSchema(): Promise<DownloadClientResource> {
    const schemas = await this.getDownloadClientSchemas();
    const seedr = schemas.find((s) => s.implementation === 'Seedr');
    if (!seedr) {
      throw new Error(
        'Seedr not found in download client schemas. Available: ' +
          schemas.map((s) => s.implementation).join(', ')
      );
    }
    return seedr;
  }

  async createDownloadClient(
    resource: DownloadClientResource
  ): Promise<DownloadClientResource> {
    return this.request('POST', '/api/v3/downloadclient', resource);
  }

  async testDownloadClient(
    resource: DownloadClientResource
  ): Promise<void> {
    // The test endpoint returns 200 with empty body on success,
    // or 400 with validation errors on failure (handled by request())
    await this.request<void>('POST', '/api/v3/downloadclient/test', resource);
  }

  async listDownloadClients(): Promise<DownloadClientResource[]> {
    return this.request('GET', '/api/v3/downloadclient');
  }

  async deleteDownloadClient(id: number): Promise<void> {
    return this.request('DELETE', `/api/v3/downloadclient/${id}`);
  }

  // Queue
  async getQueue(): Promise<QueueResponse> {
    return this.request(
      'GET',
      '/api/v5/queue?page=1&pageSize=50&includeUnknownSeriesItems=true'
    );
  }

  // Root Folders
  async addRootFolder(
    folderPath: string
  ): Promise<{ id: number; path: string }> {
    return this.request('POST', '/api/v3/rootfolder', { path: folderPath });
  }

  async listRootFolders(): Promise<Array<{ id: number; path: string }>> {
    return this.request('GET', '/api/v3/rootfolder');
  }

  // Series
  async lookupSeries(tvdbId: number): Promise<Series[]> {
    return this.request('GET', `/api/v3/series/lookup?term=tvdb:${tvdbId}`);
  }

  async addSeries(series: Series): Promise<Series> {
    return this.request('POST', '/api/v3/series', series);
  }

  async listSeries(): Promise<Series[]> {
    return this.request('GET', '/api/v3/series');
  }

  async deleteSeries(
    id: number,
    deleteFiles = false
  ): Promise<void> {
    return this.request(
      'DELETE',
      `/api/v3/series/${id}?deleteFiles=${deleteFiles}`
    );
  }

  // Quality Profiles
  async listQualityProfiles(): Promise<
    Array<{ id: number; name: string }>
  > {
    return this.request('GET', '/api/v3/qualityprofile');
  }

  // Host Config
  async getHostConfig(): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v3/config/host');
  }

  async configureAuthentication(): Promise<void> {
    const config = await this.getHostConfig();
    await this.request('PUT', '/api/v3/config/host', {
      ...config,
      authenticationMethod: 'forms',
      authenticationRequired: 'disabledForLocalAddresses',
      username: 'admin',
      password: 'admin123',
      passwordConfirmation: 'admin123',
    });
  }

  // Release Push
  async pushRelease(release: {
    title: string;
    downloadUrl?: string;
    magnetUrl?: string;
    protocol: string;
    publishDate: string;
    size: number;
    downloadClientId?: number;
  }): Promise<Array<{ rejected: boolean; rejections: string[]; title: string; [key: string]: unknown }>> {
    return this.request('POST', '/api/v3/release/push', release);
  }
}
