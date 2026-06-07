import { expect, test } from 'vitest';

import { DefaultNanoBananaPromptSource } from '../../shared/nanoBanana/constants';
import {
  normalizeNanoFeedMeta,
  normalizeNanoIndexItem,
  normalizeNanoPromptPage,
} from './nanoPromptNormalizer';

test('normalizes Nano feed meta and index items with fallback fields', () => {
  const meta = normalizeNanoFeedMeta({
    version: '2.0-static',
    lastUpdated: '2026-01-22T12:29:35Z',
    totalItems: 6018,
    itemsPerPage: 15,
    totalPages: 402,
  });
  expect(meta.totalItems).toBe(6018);

  const item = normalizeNanoIndexItem({
    id: 6845,
    title: 'Prompt title',
    categories: ['portrait'],
    page: 1,
  }, DefaultNanoBananaPromptSource.id);
  expect(item?.id).toBe('nano-supai:6845');
  expect(item?.description).toBe('');
  expect(item?.thumbnailUrl).toBeNull();
});

test('normalizes page payload and full prompt records', () => {
  const result = normalizeNanoPromptPage({
    page: 1,
    totalPages: 402,
    totalItems: 6018,
    hasNext: true,
    hasPrev: false,
    items: [{
      id: 6845,
      title: 'Prompt title',
      content: 'Create a cinematic portrait.',
      author: {
        name: 'Nano author',
        link: 'https://example.com/author',
      },
      media: ['https://example.com/image.jpg'],
      tags_zh: ['电影感'],
      needReferenceImages: true,
    }, {
      id: 6846,
      title: 'Prompt without author',
      content: 'Create a product photo.',
      author: {
        link: 'https://example.com/missing-name',
      },
    }],
  }, DefaultNanoBananaPromptSource.id, 'etag-page');

  expect(result?.page.itemCount).toBe(2);
  expect(result?.page.etag).toBe('etag-page');
  expect(result?.prompts[0].id).toBe('nano-supai:6845');
  expect(result?.prompts[0].author).toEqual({
    name: 'Nano author',
    link: 'https://example.com/author',
  });
  expect(result?.prompts[0].needReferenceImages).toBe(true);
  expect(result?.prompts[0].tagsZh).toEqual(['电影感']);
  expect(result?.prompts[1].author).toBeNull();
});
