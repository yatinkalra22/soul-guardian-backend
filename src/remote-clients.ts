/**
 * Remote Raindrop Service Clients
 *
 * These clients connect to the hosted Raindrop SmartSQL and SmartBucket services
 * allowing local development with remote database and storage.
 */

import type { SmartSql } from '@liquidmetal-ai/raindrop-framework';

/**
 * HTTP Client for Remote SmartSQL
 * Makes HTTP calls to the deployed Raindrop SmartSQL service
 */
export class RemoteSmartSqlClient implements SmartSql {
  private serviceUrl: string;

  constructor(moduleId: string, organizationId: string) {
    // SmartSQL services are accessed via internal service routes
    // Format: https://api-{moduleId}.{organizationId}.lmapp.run
    this.serviceUrl = `https://api-${moduleId}.${organizationId}.lmapp.run`;
  }

  async executeQuery(options: {
    textQuery?: string;
    sqlQuery?: string;
    format?: 'json' | 'csv';
  }): Promise<{
    message: string;
    results?: string;
    status: number;
    queryExecuted: string;
    aiReasoning?: string;
  }> {
    const response = await fetch(`${this.serviceUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error(`SmartSQL query failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      message: string;
      results?: string;
      status: number;
      queryExecuted: string;
      aiReasoning?: string;
    }>;
  }

  async getMetadata(tableName?: string): Promise<{
    tables: Array<{
      tableName: string;
      columns: Array<{
        columnName: string;
        dataType: string;
        sampleData?: string;
        nullable: boolean;
        isPrimaryKey: boolean;
      }>;
      createdAt?: string;
      updatedAt?: string;
    }>;
    lastUpdated?: string;
  }> {
    const url = new URL(`${this.serviceUrl}/metadata`);
    if (tableName) {
      url.searchParams.set('tableName', tableName);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`SmartSQL metadata fetch failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      tables: Array<{
        tableName: string;
        columns: Array<{
          columnName: string;
          dataType: string;
          sampleData?: string;
          nullable: boolean;
          isPrimaryKey: boolean;
        }>;
        createdAt?: string;
        updatedAt?: string;
      }>;
      lastUpdated?: string;
    }>;
  }

  async updateMetadata(
    tables: Array<{
      tableName: string;
      columns: Array<{
        columnName: string;
        dataType: string;
        sampleData?: string;
        nullable: boolean;
        isPrimaryKey: boolean;
      }>;
    }>,
    mode?: 'replace' | 'merge' | 'append'
  ): Promise<{
    success: boolean;
    tablesUpdated: number;
    message: string;
  }> {
    const response = await fetch(`${this.serviceUrl}/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tables, mode }),
    });

    if (!response.ok) {
      throw new Error(`SmartSQL metadata update failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      success: boolean;
      tablesUpdated: number;
      message: string;
    }>;
  }

  async getPiiData(
    tableName: string,
    recordId?: string
  ): Promise<{
    piiDetections: Array<{
      detectionId: string;
      tableName: string;
      recordId: string;
      entities: Array<{
        entityType: string;
        confidenceScore: number;
        detectedText: string;
        startPosition: number;
        endPosition: number;
        tokenIndex: number;
      }>;
      detectedAt: string;
    }>;
  }> {
    const url = new URL(`${this.serviceUrl}/pii`);
    url.searchParams.set('tableName', tableName);
    if (recordId) {
      url.searchParams.set('recordId', recordId);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`SmartSQL PII data fetch failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      piiDetections: Array<{
        detectionId: string;
        tableName: string;
        recordId: string;
        entities: Array<{
          entityType: string;
          confidenceScore: number;
          detectedText: string;
          startPosition: number;
          endPosition: number;
          tokenIndex: number;
        }>;
        detectedAt: string;
      }>;
    }>;
  }
}

/**
 * HTTP Client for Remote SmartBucket (R2)
 * Makes HTTP calls to the deployed Raindrop SmartBucket service
 */
export class RemoteSmartBucketClient {
  private serviceUrl: string;

  constructor(moduleId: string, organizationId: string) {
    // SmartBucket services are accessed via their public API URL
    this.serviceUrl = `https://api-${moduleId}.${organizationId}.lmapp.run`;
  }

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream | Blob,
    options?: {
      httpMetadata?: {
        contentType?: string;
        contentLanguage?: string;
        contentDisposition?: string;
        contentEncoding?: string;
        cacheControl?: string;
        cacheExpiry?: Date;
      };
      customMetadata?: Record<string, string>;
    }
  ): Promise<{ key: string; size: number; etag: string }> {
    const formData = new FormData();

    let blob: Blob;
    if (value instanceof Blob) {
      blob = value;
    } else if (typeof value === 'string') {
      blob = new Blob([value], { type: options?.httpMetadata?.contentType || 'text/plain' });
    } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const buffer = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer);
      blob = new Blob([buffer], { type: options?.httpMetadata?.contentType || 'application/octet-stream' });
    } else {
      throw new Error('Unsupported value type for put operation');
    }

    formData.append('file', blob, key);

    if (options?.httpMetadata) {
      formData.append('httpMetadata', JSON.stringify(options.httpMetadata));
    }

    if (options?.customMetadata) {
      formData.append('customMetadata', JSON.stringify(options.customMetadata));
    }

    const response = await fetch(`${this.serviceUrl}/objects/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`SmartBucket put failed: ${response.statusText}`);
    }

    return response.json() as Promise<{ key: string; size: number; etag: string }>;
  }

  async get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: {
      contentType?: string;
      contentLanguage?: string;
      contentDisposition?: string;
      contentEncoding?: string;
      cacheControl?: string;
    };
    customMetadata?: Record<string, string>;
    size: number;
    etag: string;
    uploaded: Date;
  } | null> {
    const response = await fetch(`${this.serviceUrl}/objects/${encodeURIComponent(key)}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`SmartBucket get failed: ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type') || undefined;
    const contentLength = response.headers.get('Content-Length');
    const etag = response.headers.get('ETag') || '';
    const lastModified = response.headers.get('Last-Modified');

    return {
      body: response.body!,
      httpMetadata: {
        contentType,
      },
      size: contentLength ? parseInt(contentLength, 10) : 0,
      etag,
      uploaded: lastModified ? new Date(lastModified) : new Date(),
    };
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`${this.serviceUrl}/objects/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`SmartBucket delete failed: ${response.statusText}`);
    }
  }

  async list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    objects: Array<{
      key: string;
      size: number;
      etag: string;
      uploaded: Date;
    }>;
    truncated: boolean;
    cursor?: string;
  }> {
    const url = new URL(`${this.serviceUrl}/objects`);
    if (options?.prefix) url.searchParams.set('prefix', options.prefix);
    if (options?.limit) url.searchParams.set('limit', options.limit.toString());
    if (options?.cursor) url.searchParams.set('cursor', options.cursor);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`SmartBucket list failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      objects: Array<{
        key: string;
        size: number;
        etag: string;
        uploaded: Date;
      }>;
      truncated: boolean;
      cursor?: string;
    }>;
  }

  // SmartBucket-specific search methods
  async search(input: {
    input: string;
    requestId?: string;
    partition?: string;
  }): Promise<any> {
    const response = await fetch(`${this.serviceUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`SmartBucket search failed: ${response.statusText}`);
    }

    return response.json();
  }

  async chunkSearch(input: {
    input: string;
    requestId: string;
    partition?: string;
  }): Promise<any> {
    const response = await fetch(`${this.serviceUrl}/chunk-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`SmartBucket chunk search failed: ${response.statusText}`);
    }

    return response.json();
  }

  async documentChat(input: {
    objectId: string;
    input: string;
    requestId: string;
    partition?: string;
  }): Promise<any> {
    const response = await fetch(`${this.serviceUrl}/document-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`SmartBucket document chat failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getPaginatedResults(input: {
    requestId: string;
    page?: number;
    pageSize?: number;
    partition?: string;
  }): Promise<any> {
    const response = await fetch(`${this.serviceUrl}/paginated-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`SmartBucket get paginated results failed: ${response.statusText}`);
    }

    return response.json();
  }
}
