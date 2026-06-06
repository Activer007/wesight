import BetterSqlite3 from 'better-sqlite3';
import { afterEach, expect, test } from 'vitest';

import { DefaultNanoBananaPromptSource, NanoBananaSearchSort } from '../../shared/nanoBanana/constants';
import { NanoPromptSearch, normalizeNanoSearchInput } from './nanoPromptSearch';
import { createNanoPromptId, NanoPromptStore } from './nanoPromptStore';

const databases: BetterSqlite3.Database[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) {
    db.close();
  }
});

const createSearch = () => {
  const db = new BetterSqlite3(':memory:');
  databases.push(db);
  const store = new NanoPromptStore(db);
  store.ensureDefaultSource(1000);
  store.upsertIndexItems([
    {
      id: createNanoPromptId(DefaultNanoBananaPromptSource.id, '1'),
      sourceId: DefaultNanoBananaPromptSource.id,
      sourcePromptId: '1',
      title: 'Portrait studio',
      description: 'Dramatic lighting',
      authorName: 'A',
      categories: ['portrait'],
      publishedAt: '2026-01-02T00:00:00Z',
      likes: 20,
      resultsCount: 2,
      page: 1,
      searchTerms: 'portrait studio lighting',
      thumbnailUrl: null,
      raw: { tags: ['lighting'], needReferenceImages: true },
    },
    {
      id: createNanoPromptId(DefaultNanoBananaPromptSource.id, '2'),
      sourceId: DefaultNanoBananaPromptSource.id,
      sourcePromptId: '2',
      title: 'UI card',
      description: 'Clean product interface',
      authorName: 'B',
      categories: ['ui'],
      publishedAt: '2026-01-03T00:00:00Z',
      likes: 5,
      resultsCount: 8,
      page: 1,
      searchTerms: 'ui card product interface',
      thumbnailUrl: null,
      raw: { tags: ['product'], needReferenceImages: false },
    },
  ], 1100);
  store.upsertPrompts([{
    id: createNanoPromptId(DefaultNanoBananaPromptSource.id, '1'),
    sourceId: DefaultNanoBananaPromptSource.id,
    sourcePromptId: '1',
    title: 'Portrait studio',
    description: 'Dramatic lighting',
    content: 'Create a portrait.',
    translatedContent: null,
    sourceLink: null,
    sourcePlatform: null,
    sourcePublishedAt: null,
    author: null,
    media: [],
    mediaThumbnails: [],
    language: 'en',
    searchIndex: 'portrait studio lighting',
    likes: 20,
    resultsCount: 2,
    needReferenceImages: true,
    promptCategories: ['portrait'],
    tags: ['lighting'],
    tagsZh: ['光线'],
    page: 1,
    raw: {},
  }], 1200);
  return new NanoPromptSearch(store);
};

test('clamps search input bounds', () => {
  const input = normalizeNanoSearchInput({ limit: 999, offset: -1, query: 'ui' });
  expect(input.limit).toBe(100);
  expect(input.offset).toBe(0);
  expect(input.sort).toBe(NanoBananaSearchSort.Relevance);
});

test('searches by query, category, tags, reference image flag, and sort', () => {
  const search = createSearch();

  expect(search.search({ query: 'portrait' }).items[0].sourcePromptId).toBe('1');
  expect(search.search({ categories: ['ui'] }).items[0].sourcePromptId).toBe('2');
  expect(search.search({ tags: ['lighting'], needReferenceImages: true }).items[0].sourcePromptId).toBe('1');
  expect(search.search({ sort: NanoBananaSearchSort.ResultsDesc }).items[0].sourcePromptId).toBe('2');
});
