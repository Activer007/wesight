import BetterSqlite3 from 'better-sqlite3';
import { afterEach, expect, test } from 'vitest';

import {
  DefaultNanoBananaPromptSource,
  NanoBananaPromptImportType,
  NanoBananaSourceStatus,
  NanoBananaUsageEventType,
} from '../../shared/nanoBanana/constants';
import type {
  NanoBananaPrompt,
  NanoBananaPromptIndexItem,
  NanoBananaPromptPage,
} from '../../shared/nanoBanana/types';
import { createNanoPromptId, NanoPromptStore } from './nanoPromptStore';

const databases: BetterSqlite3.Database[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) {
    db.close();
  }
});

const createStore = (): NanoPromptStore => {
  const db = new BetterSqlite3(':memory:');
  db.pragma('foreign_keys = ON');
  databases.push(db);
  return new NanoPromptStore(db);
};

const createIndexItem = (sourcePromptId: string): NanoBananaPromptIndexItem => ({
  id: createNanoPromptId(DefaultNanoBananaPromptSource.id, sourcePromptId),
  sourceId: DefaultNanoBananaPromptSource.id,
  sourcePromptId,
  title: 'Gallery prompt',
  description: 'A concise visual prompt.',
  authorName: 'Nano Author',
  categories: ['portrait', 'studio'],
  publishedAt: '2026-01-22T12:29:35Z',
  likes: 12,
  resultsCount: 3,
  page: 1,
  searchTerms: 'gallery prompt portrait studio',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  raw: {
    id: Number(sourcePromptId),
    title: 'Gallery prompt',
  },
});

const createPrompt = (sourcePromptId: string): NanoBananaPrompt => ({
  id: createNanoPromptId(DefaultNanoBananaPromptSource.id, sourcePromptId),
  sourceId: DefaultNanoBananaPromptSource.id,
  sourcePromptId,
  title: 'Gallery prompt',
  description: 'A concise visual prompt.',
  content: 'Create a studio portrait with dramatic light.',
  translatedContent: '创建一张具有戏剧光线的棚拍肖像。',
  sourceLink: 'https://example.com/source',
  sourcePlatform: 'x',
  sourcePublishedAt: '2026-01-22T12:29:35Z',
  author: {
    name: 'Nano Author',
    link: 'https://example.com/author',
  },
  media: ['https://example.com/image.jpg'],
  mediaThumbnails: ['https://example.com/thumb.jpg'],
  language: 'en',
  searchIndex: 'studio portrait dramatic light',
  likes: 12,
  resultsCount: 3,
  needReferenceImages: true,
  promptCategories: ['portrait', 'studio'],
  tags: ['lighting'],
  tagsZh: ['光线'],
  page: 1,
  raw: {
    id: Number(sourcePromptId),
    content: 'Create a studio portrait with dramatic light.',
  },
});

const createPage = (): NanoBananaPromptPage => ({
  sourceId: DefaultNanoBananaPromptSource.id,
  page: 1,
  totalPages: 402,
  totalItems: 6018,
  hasNext: true,
  hasPrev: false,
  itemCount: 15,
  etag: 'W/"page-etag"',
  raw: {
    page: 1,
    items: [{ id: 6845 }],
  },
});

test('creates the Nano prompt schema idempotently and writes the default source', () => {
  const db = new BetterSqlite3(':memory:');
  databases.push(db);
  const firstStore = new NanoPromptStore(db);
  const secondStore = new NanoPromptStore(db);

  const source = firstStore.ensureDefaultSource(1000);
  const stored = secondStore.getSource(DefaultNanoBananaPromptSource.id);

  const rows = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name IN (
        'nano_sources',
        'nano_prompt_index_items',
        'nano_prompts',
        'nano_prompt_pages',
        'nano_prompt_imports',
        'nano_prompt_usage_events'
      )
  `).all() as Array<{ name: string }>;

  const tableNames = new Set(rows.map((row) => row.name));
  expect(tableNames.has('nano_sources')).toBe(true);
  expect(tableNames.has('nano_prompt_index_items')).toBe(true);
  expect(tableNames.has('nano_prompts')).toBe(true);
  expect(tableNames.has('nano_prompt_pages')).toBe(true);
  expect(tableNames.has('nano_prompt_imports')).toBe(true);
  expect(tableNames.has('nano_prompt_usage_events')).toBe(true);
  expect(source.id).toBe(DefaultNanoBananaPromptSource.id);
  expect(stored?.baseUrl).toBe(DefaultNanoBananaPromptSource.baseUrl);
  expect(stored?.paths.page).toBe(DefaultNanoBananaPromptSource.paths.page);
});

test('upserts and reads index items, pages, full prompts, imports, usage events, and status', () => {
  const store = createStore();
  store.ensureDefaultSource(1000);

  const indexItem = createIndexItem('6845');
  expect(store.upsertIndexItems([indexItem], 1100)).toBe(1);
  const updatedIndexItem = {
    ...indexItem,
    title: 'Updated prompt',
    likes: 20,
  };
  store.upsertIndexItems([updatedIndexItem], 1200);

  const storedIndexItem = store.getIndexItem(indexItem.id);
  expect(storedIndexItem?.title).toBe('Updated prompt');
  expect(storedIndexItem?.likes).toBe(20);
  expect(storedIndexItem?.categories).toEqual(['portrait', 'studio']);

  const page = store.upsertPage(createPage(), 1300);
  expect(page.etag).toBe('W/"page-etag"');
  expect(store.getPage(DefaultNanoBananaPromptSource.id, 1)?.itemCount).toBe(15);

  const prompt = createPrompt('6845');
  expect(store.upsertPrompts([prompt], 1400)).toBe(1);
  const storedPrompt = store.getPromptBySourcePromptId(DefaultNanoBananaPromptSource.id, '6845');
  expect(storedPrompt?.content).toBe('Create a studio portrait with dramatic light.');
  expect(storedPrompt?.needReferenceImages).toBe(true);
  expect(storedPrompt?.tagsZh).toEqual(['光线']);

  const importRecord = store.recordImport({
    sourceId: DefaultNanoBananaPromptSource.id,
    promptId: prompt.id,
    sourcePromptId: prompt.sourcePromptId,
    importType: NanoBananaPromptImportType.Builder,
    targetId: 'builder-draft-1',
    metadata: { mode: 'seed' },
  }, 1500);
  expect(importRecord.importType).toBe(NanoBananaPromptImportType.Builder);

  const usageEvent = store.recordUsageEvent({
    sourceId: DefaultNanoBananaPromptSource.id,
    promptId: prompt.id,
    sourcePromptId: prompt.sourcePromptId,
    eventType: NanoBananaUsageEventType.Copy,
    importType: NanoBananaPromptImportType.Builder,
  }, 1600);
  expect(usageEvent.eventType).toBe(NanoBananaUsageEventType.Copy);

  const status = store.getStatus(DefaultNanoBananaPromptSource.id);
  expect(status?.status).toBe(NanoBananaSourceStatus.Ready);
  expect(status?.indexItemCount).toBe(1);
  expect(status?.cachedPromptCount).toBe(1);
  expect(status?.cachedPageCount).toBe(1);
});

test('upserts more than 6000 index items for a source', () => {
  const store = createStore();
  store.ensureDefaultSource(1000);

  const items = Array.from({ length: 6001 }, (_, index) => createIndexItem(String(index + 1)));
  expect(store.upsertIndexItems(items, 1100)).toBe(6001);

  const status = store.getStatus(DefaultNanoBananaPromptSource.id);
  expect(status?.indexItemCount).toBe(6001);
  expect(store.listIndexItems(DefaultNanoBananaPromptSource.id, 10)).toHaveLength(10);
});
