import { ZodError } from 'zod';
import {
  DescribeAllResponseSchema,
  TableSchemaSchema,
  SystemInfoSchema,
  type DescribeAllResponse,
  type TableSchema,
  type SearchByIdParams,
  type SearchByValueParams,
  type SearchByConditionsParams,
  type SystemInfo,
} from './types.js';
import { api as log } from '../logger.js';

function formatZodError(err: ZodError): string {
  const issues = err.issues.slice(0, 3);
  const lines = issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  if (err.issues.length > 3) {
    lines.push(`  ...and ${err.issues.length - 3} more`);
  }
  return `Unexpected response shape:\n${lines.join('\n')}`;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('enetunreach') ||
      msg.includes('socket hang up') ||
      msg.includes('abort')
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HarperClient {
  private url = '';
  private authHeader = '';
  private connected = false;
  private schemaCache = new Map<string, CacheEntry<any>>();
  private cacheTTL = 60_000;
  private lastQueryTime = 0;

  async connect(url: string, username: string, password: string): Promise<void> {
    log.info('Connecting to %s as %s', url, username);
    this.url = url.replace(/\/+$/, '');
    this.authHeader = 'Basic ' + btoa(`${username}:${password}`);
    this.connected = false;
    this.schemaCache.clear();

    try {
      await this.describeAll();
      this.connected = true;
      log.info('Connected successfully');
    } catch (error) {
      log.error('Connection failed: %s', error instanceof Error ? error.message : error);
      this.url = '';
      this.authHeader = '';
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('401') || msg.includes('unauthorized')) {
          throw new Error('Authentication failed: invalid username or password');
        }
        if (msg.includes('econnrefused') || msg.includes('fetch failed')) {
          throw new Error(`Cannot reach Harper instance at ${url} — is it running?`);
        }
      }
      throw new Error(`Failed to connect to Harper: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async describeAll(): Promise<DescribeAllResponse> {
    const cacheKey = 'describe_all';
    const cached = this.getCached<DescribeAllResponse>(cacheKey);
    if (cached !== undefined) return cached;

    const raw = await this.execute({ operation: 'describe_all' });
    let parsed: DescribeAllResponse;
    try {
      parsed = DescribeAllResponseSchema.parse(raw);
    } catch (err) {
      throw err instanceof ZodError ? new Error(formatZodError(err)) : err;
    }
    this.setCache(cacheKey, parsed);
    return parsed;
  }

  async describeDatabase(database: string): Promise<Record<string, TableSchema>> {
    const cacheKey = `describe_db:${database}`;
    const cached = this.getCached<Record<string, TableSchema>>(cacheKey);
    if (cached !== undefined) return cached;

    const all = await this.describeAll();
    const db = all[database];
    if (!db) {
      throw new Error(`Database "${database}" not found`);
    }
    this.setCache(cacheKey, db);
    return db;
  }

  async describeTable(database: string, table: string): Promise<TableSchema> {
    const cacheKey = `describe_table:${database}.${table}`;
    const cached = this.getCached<TableSchema>(cacheKey);
    if (cached !== undefined) return cached;

    const db = await this.describeDatabase(database);
    const tbl = db[table];
    if (!tbl) {
      throw new Error(`Table "${table}" not found in database "${database}"`);
    }
    let parsed: TableSchema;
    try {
      parsed = TableSchemaSchema.parse(tbl);
    } catch (err) {
      throw err instanceof ZodError ? new Error(formatZodError(err)) : err;
    }
    this.setCache(cacheKey, parsed);
    return parsed;
  }

  async searchById(params: SearchByIdParams): Promise<Record<string, any>[]> {
    const body: Record<string, any> = {
      operation: 'search_by_id',
      table: params.table,
      ids: params.ids,
    };
    if (params.database) body.schema = params.database;
    if (params.getAttributes) body.get_attributes = params.getAttributes;

    return this.execute(body) as Promise<Record<string, any>[]>;
  }

  async searchByValue(params: SearchByValueParams): Promise<Record<string, any>[]> {
    const body: Record<string, any> = {
      operation: 'search_by_value',
      table: params.table,
      search_attribute: params.attribute,
      search_value: params.value,
    };
    if (params.database) body.schema = params.database;
    if (params.getAttributes) body.get_attributes = params.getAttributes;
    if (params.limit !== undefined) body.limit = params.limit;
    if (params.offset !== undefined) body.offset = params.offset;

    return this.execute(body) as Promise<Record<string, any>[]>;
  }

  async searchByConditions(params: SearchByConditionsParams & { hashAttribute?: string }): Promise<Record<string, any>[]> {
    // Harper requires at least 1 condition; fall back to search_by_value wildcard
    if (params.conditions.length === 0) {
      return this.searchByValue({
        database: params.database,
        table: params.table,
        attribute: params.hashAttribute ?? params.sort?.attribute ?? 'id',
        value: '*',
        getAttributes: params.getAttributes,
        limit: params.limit,
        offset: params.offset,
      });
    }

    const body: Record<string, any> = {
      operation: 'search_by_conditions',
      table: params.table,
      conditions: params.conditions,
    };
    if (params.database) body.schema = params.database;
    if (params.operator) body.operator = params.operator;
    if (params.offset !== undefined) body.offset = params.offset;
    if (params.limit !== undefined) body.limit = params.limit;
    if (params.sort) body.sort = params.sort;
    if (params.getAttributes) body.get_attributes = params.getAttributes;

    return this.execute(body) as Promise<Record<string, any>[]>;
  }

  async systemInformation(attributes?: string[]): Promise<SystemInfo> {
    const body: Record<string, any> = { operation: 'system_information' };
    if (attributes) body.attributes = attributes;

    const raw = await this.execute(body);
    try {
      return SystemInfoSchema.parse(raw);
    } catch (err) {
      throw err instanceof ZodError ? new Error(formatZodError(err)) : err;
    }
  }

  clearCache(): void {
    this.schemaCache.clear();
  }

  getLastQueryTime(): number {
    return this.lastQueryTime;
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private getCached<T>(key: string): T | undefined {
    const entry = this.schemaCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.schemaCache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.schemaCache.set(key, { data, timestamp: Date.now() });
  }

  private async execute(body: Record<string, any>): Promise<unknown> {
    let lastError: Error | undefined;
    const op = body.operation ?? 'unknown';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        log.warn('%s retry %d/%d', op, attempt, MAX_RETRIES);
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
      }

      log.debug('%s %o', op, { ...body, operation: undefined });
      const start = performance.now();
      try {
        const response = await fetch(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.authHeader,
          },
          body: JSON.stringify(body),
        });

        this.lastQueryTime = Math.round(performance.now() - start);

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          const msg = `Harper API error (${response.status}): ${text || response.statusText}`;
          log.error('%s failed (%dms): %s', op, this.lastQueryTime, msg);
          // Don't retry auth or client errors
          if (response.status >= 400 && response.status < 500) {
            throw new Error(msg);
          }
          lastError = new Error(msg);
          continue;
        }

        log.info('%s OK (%dms)', op, this.lastQueryTime);
        return await response.json();
      } catch (error) {
        this.lastQueryTime = Math.round(performance.now() - start);

        if (error instanceof Error && !isNetworkError(error) && !error.message.startsWith('Harper API error (5')) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }
}
