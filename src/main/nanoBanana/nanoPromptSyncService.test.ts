import BetterSqlite3 from 'better-sqlite3';
import { afterEach, expect, test, vi } from 'vitest';

import { DefaultNanoBananaPromptSource, NanoBananaSyncStatus } from '../../shared/nanoBanana/constants';
import { NanoPromptStore } from './nanoPromptStore';
import { NanoPromptSyncService } from './nanoPromptSyncService';
import { NanoRemoteJsonClient } from './nanoRemoteJsonClient';

const databases: BetterSqlite3.Database[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) {
    db.close();
  }
});

const createService = (fetchImpl: typeof fetch) => {
  const db = new BetterSqlite3(':memory:');
  databases.push(db);
  const store = new NanoPromptStore(db);
  const client = new NanoRemoteJsonClient({ fetchImpl });
  return {
    store,
    service: new NanoPromptSyncService(store, client),
  };
};

test('syncs meta and index into the local cache', async () => {
  const fetchImpl = vi.fn(async (url: string) => {
    if (url.endsWith('/data/meta.json')) {
      return new Response(JSON.stringify({
        version: '2.0-static',
        lastUpdated: '2026-01-22T12:29:35Z',
        totalItems: 1,
        itemsPerPage: 15,
        totalPages: 1,
      }), { status: 200, headers: { etag: 'meta-etag' } });
    }
    return new Response(JSON.stringify({
      version: '2.0-static',
      indexes: [{
        id: 6845,
        title: 'Portrait studio',
        description: 'Dramatic lighting',
        authorName: 'Nano',
        categories: ['portrait'],
        publishedAt: '2026-01-22T12:29:35Z',
        likes: 10,
        resultsCount: 2,
        page: 1,
        searchTerms: 'portrait studio',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      }],
    }), { status: 200, headers: { etag: 'index-etag' } });
  }) as unknown as typeof fetch;
  const { store, service } = createService(fetchImpl);

  const result = await service.sync({ force: true });

  expect(result.status).toBe(NanoBananaSyncStatus.Completed);
  expect(result.indexItemCount).toBe(1);
  expect(store.getSource(DefaultNanoBananaPromptSource.id)?.etagMeta).toBe('meta-etag');
  expect(store.getSource(DefaultNanoBananaPromptSource.id)?.etagIndex).toBe('index-etag');
  expect(store.getIndexItem('nano-supai:6845')?.title).toBe('Portrait studio');
});

test('lazily fetches a page by prompt id and caches full prompts', async () => {
  const fetchImpl = vi.fn(async (url: string) => {
    if (url.includes('page-1.json')) {
      return new Response(JSON.stringify({
        page: 1,
        totalPages: 1,
        totalItems: 1,
        hasNext: false,
        hasPrev: false,
        items: [{
          id: 6845,
          title: 'Portrait studio',
          content: 'Create a portrait.',
          media: ['https://example.com/image.jpg'],
          mediaThumbnails: ['https://example.com/thumb.jpg'],
          promptCategories: ['portrait'],
          tags: ['lighting'],
          tags_zh: ['光线'],
          needReferenceImages: true,
        }],
      }), { status: 200, headers: { etag: 'page-etag' } });
    }
    return new Response('{}', { status: 500 });
  }) as unknown as typeof fetch;
  const { store, service } = createService(fetchImpl);
  store.ensureDefaultSource(1000);
  store.upsertIndexItems([{
    id: 'nano-supai:6845',
    sourceId: DefaultNanoBananaPromptSource.id,
    sourcePromptId: '6845',
    title: 'Portrait studio',
    description: '',
    authorName: '',
    categories: ['portrait'],
    publishedAt: null,
    likes: 0,
    resultsCount: 0,
    page: 1,
    searchTerms: 'portrait studio',
    thumbnailUrl: null,
    raw: {},
  }], 1000);

  const result = await service.getPrompt({ sourcePromptId: '6845' });

  expect(result.prompt?.id).toBe('nano-supai:6845');
  expect(result.prompt?.content).toBe('Create a portrait.');
  expect(store.getPage(DefaultNanoBananaPromptSource.id, 1)?.etag).toBe('page-etag');
});

test('returns cached index status when sync network requests fail', async () => {
  const fetchImpl = vi.fn(async () => {
    throw new Error('network unavailable');
  }) as unknown as typeof fetch;
  const { store, service } = createService(fetchImpl);
  store.ensureDefaultSource(1000);
  store.upsertIndexItems([{
    id: 'nano-supai:1',
    sourceId: DefaultNanoBananaPromptSource.id,
    sourcePromptId: '1',
    title: 'Cached',
    description: '',
    authorName: '',
    categories: [],
    publishedAt: null,
    likes: 0,
    resultsCount: 0,
    page: 1,
    searchTerms: 'cached',
    thumbnailUrl: null,
    raw: {},
  }], 1000);

  const result = await service.sync({ force: true });

  expect(result.status).toBe(NanoBananaSyncStatus.PartialFailed);
  expect(result.indexItemCount).toBe(1);
  expect(result.warnings[0]).toContain('network unavailable');
});
