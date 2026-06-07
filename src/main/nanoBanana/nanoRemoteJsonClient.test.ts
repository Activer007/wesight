import { expect, test, vi } from 'vitest';

import { DefaultNanoBananaPromptSource } from '../../shared/nanoBanana/constants';
import { NanoRemoteJsonClient, NanoRemoteJsonError } from './nanoRemoteJsonClient';

test('builds source URLs and sends ETag headers', async () => {
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    expect(init?.headers).toEqual({ 'If-None-Match': 'etag-1' });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        etag: 'etag-2',
      },
    });
  }) as unknown as typeof fetch;
  const client = new NanoRemoteJsonClient({ fetchImpl });

  const url = client.buildUrl(DefaultNanoBananaPromptSource, DefaultNanoBananaPromptSource.paths.page, { page: 7 });
  expect(url).toBe('https://nano.supai.site/data/pages/page-7.json');

  const result = await client.fetchMeta<{ ok: boolean }>(DefaultNanoBananaPromptSource, 'etag-1');
  expect(result.data?.ok).toBe(true);
  expect(result.etag).toBe('etag-2');
  expect(fetchImpl).toHaveBeenCalledOnce();
});

test('handles not modified responses without parsing a body', async () => {
  const fetchImpl = vi.fn(async () => new Response(null, { status: 304 })) as unknown as typeof fetch;
  const client = new NanoRemoteJsonClient({ fetchImpl });

  const result = await client.fetchIndex(DefaultNanoBananaPromptSource, 'etag-1');

  expect(result.notModified).toBe(true);
  expect(result.data).toBeNull();
});

test('fails on oversized and invalid JSON responses', async () => {
  const oversized = new NanoRemoteJsonClient({
    maxBytes: { meta: 2, index: 2, page: 2 },
    fetchImpl: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch,
  });
  await expect(oversized.fetchMeta(DefaultNanoBananaPromptSource)).rejects.toMatchObject({
    code: 'response_too_large',
  } satisfies Partial<NanoRemoteJsonError>);

  const invalidJson = new NanoRemoteJsonClient({
    fetchImpl: vi.fn(async () => new Response('not json', { status: 200 })) as unknown as typeof fetch,
  });
  await expect(invalidJson.fetchMeta(DefaultNanoBananaPromptSource)).rejects.toMatchObject({
    code: 'json_parse_error',
  } satisfies Partial<NanoRemoteJsonError>);
});
