const SEEDR_BASE_URL = 'https://www.seedr.cc/rest';

export interface SeedrApiOptions {
  email: string;
  password: string;
}

interface SeedrFolder {
  id: number;
  name: string;
  size: number;
  [key: string]: unknown;
}

interface SeedrFile {
  id: number;
  name: string;
  size: number;
  [key: string]: unknown;
}

interface SeedrTransfer {
  id: number;
  name: string;
  progress: number;
  [key: string]: unknown;
}

interface SeedrFolderContents {
  folders?: SeedrFolder[];
  files?: SeedrFile[];
  transfers?: SeedrTransfer[];
  [key: string]: unknown;
}

interface SeedrUser {
  username: string;
  space_used: number;
  space_max: number;
  [key: string]: unknown;
}

export class SeedrApi {
  private authHeader: string;

  constructor(options: SeedrApiOptions) {
    this.authHeader =
      'Basic ' +
      Buffer.from(`${options.email}:${options.password}`).toString('base64');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, string>
  ): Promise<T> {
    const url = `${SEEDR_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };

    let fetchBody: string | URLSearchParams | undefined;
    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      fetchBody = new URLSearchParams(body).toString();
    }

    const response = await fetch(url, {
      method,
      headers,
      body: fetchBody,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Seedr API ${method} ${path} failed with ${response.status}: ${text}`
      );
    }

    return (await response.json()) as T;
  }

  async getUser(): Promise<SeedrUser> {
    return this.request('GET', '/user');
  }

  async getFolderContents(folderId?: number): Promise<SeedrFolderContents> {
    const path = folderId ? `/folder/${folderId}` : '/folder';
    return this.request('GET', path);
  }

  async deleteFolder(folderId: number): Promise<void> {
    await this.request('DELETE', `/folder/${folderId}`);
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.request('DELETE', `/file/${fileId}`);
  }

  async deleteTransfer(transferId: number): Promise<void> {
    await this.request('DELETE', `/transfer/${transferId}`);
  }

  async cleanupAllContent(): Promise<void> {
    console.log('Cleaning up all Seedr cloud content...');

    const contents = await this.getFolderContents();

    // Delete transfers first
    if (contents.transfers) {
      for (const transfer of contents.transfers) {
        try {
          await this.deleteTransfer(transfer.id);
          console.log(`  Deleted transfer: ${transfer.name}`);
        } catch (err) {
          console.warn(`  Warning: failed to delete transfer ${transfer.id}:`, err);
        }
      }
    }

    // Delete folders
    if (contents.folders) {
      for (const folder of contents.folders) {
        try {
          await this.deleteFolder(folder.id);
          console.log(`  Deleted folder: ${folder.name}`);
        } catch (err) {
          console.warn(`  Warning: failed to delete folder ${folder.id}:`, err);
        }
      }
    }

    // Delete files
    if (contents.files) {
      for (const file of contents.files) {
        try {
          await this.deleteFile(file.id);
          console.log(`  Deleted file: ${file.name}`);
        } catch (err) {
          console.warn(`  Warning: failed to delete file ${file.id}:`, err);
        }
      }
    }

    console.log('Seedr cloud cleanup complete');
  }
}
