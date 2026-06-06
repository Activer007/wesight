import type { NanoBananaPromptSource } from '../../shared/nanoBanana/types';

export interface NanoRemoteJsonClientOptions {
  timeoutMs?: number;
  maxBytes?: {
    meta: number;
    index: number;
    page: number;
  };
  fetchImpl?: typeof fetch;
}

export interface NanoRemoteJsonResult<T> {
  status: number;
  ok: boolean;
  notModified: boolean;
  url: string;
  etag: string | null;
  bytes: number;
  headers: Record<string, string>;
  data: T | null;
}

export class NanoRemoteJsonError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'NanoRemoteJsonError';
  }
}

const DefaultMaxBytes = {
  meta: 1 * 1024 * 1024,
  index: 80 * 1024 * 1024,
  page: 20 * 1024 * 1024,
};

const getHeaders = (headers: Headers): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const readLimitedBody = async (response: Response, maxBytes: number): Promise<{ text: string; bytes: number }> => {
  if (!response.body) {
    const text = await response.text();
    const bytes = Buffer.byteLength(text);
    if (bytes > maxBytes) {
      throw new NanoRemoteJsonError(`Response exceeded ${maxBytes} bytes`, 'response_too_large', response.status);
    }
    return { text, bytes };
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new NanoRemoteJsonError(`Response exceeded ${maxBytes} bytes`, 'response_too_large', response.status);
    }
    chunks.push(Buffer.from(value));
  }

  const buffer = Buffer.concat(chunks);
  return {
    text: buffer.toString('utf8'),
    bytes,
  };
};

export class NanoRemoteJsonClient {
  private readonly timeoutMs: number;
  private readonly maxBytes: NanoRemoteJsonClientOptions['maxBytes'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: NanoRemoteJsonClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxBytes = options.maxBytes ?? DefaultMaxBytes;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  buildUrl(source: NanoBananaPromptSource, pathTemplate: string, replacements: Record<string, string | number> = {}): string {
    const path = Object.entries(replacements).reduce(
      (current, [key, value]) => current.replaceAll(`{${key}}`, encodeURIComponent(String(value))),
      pathTemplate,
    );
    const base = source.baseUrl.endsWith('/') ? source.baseUrl : `${source.baseUrl}/`;
    return new URL(path.replace(/^\/+/, ''), base).toString();
  }

  fetchMeta<T>(source: NanoBananaPromptSource, etag?: string | null): Promise<NanoRemoteJsonResult<T>> {
    return this.fetchJson<T>(this.buildUrl(source, source.paths.meta), this.maxBytes!.meta, etag);
  }

  fetchIndex<T>(source: NanoBananaPromptSource, etag?: string | null): Promise<NanoRemoteJsonResult<T>> {
    return this.fetchJson<T>(this.buildUrl(source, source.paths.index), this.maxBytes!.index, etag);
  }

  fetchPage<T>(source: NanoBananaPromptSource, page: number, etag?: string | null): Promise<NanoRemoteJsonResult<T>> {
    return this.fetchJson<T>(this.buildUrl(source, source.paths.page, { page }), this.maxBytes!.page, etag);
  }

  async fetchJson<T>(url: string, maxBytes: number, etag?: string | null): Promise<NanoRemoteJsonResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: etag ? { 'If-None-Match': etag } : undefined,
        signal: controller.signal,
      });
      const headers = getHeaders(response.headers);
      const responseEtag = response.headers.get('etag');

      if (response.status === 304) {
        return {
          status: response.status,
          ok: true,
          notModified: true,
          url,
          etag: responseEtag ?? etag ?? null,
          bytes: 0,
          headers,
          data: null,
        };
      }

      if (!response.ok) {
        throw new NanoRemoteJsonError(`Request failed with HTTP ${response.status}`, 'http_error', response.status);
      }

      const body = await readLimitedBody(response, maxBytes);
      let data: T;
      try {
        data = JSON.parse(body.text) as T;
      } catch (error) {
        throw new NanoRemoteJsonError(
          error instanceof Error ? error.message : 'JSON parse failed',
          'json_parse_error',
          response.status,
        );
      }

      return {
        status: response.status,
        ok: true,
        notModified: false,
        url,
        etag: responseEtag,
        bytes: body.bytes,
        headers,
        data,
      };
    } catch (error) {
      if (error instanceof NanoRemoteJsonError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NanoRemoteJsonError('Request timed out', 'timeout');
      }
      throw new NanoRemoteJsonError(
        error instanceof Error ? error.message : 'Request failed',
        'fetch_failed',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
