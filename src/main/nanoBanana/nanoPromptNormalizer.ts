import { NanoBananaDefaultSourceId } from '../../shared/nanoBanana/constants';
import type {
  NanoBananaFeedMeta,
  NanoBananaPrompt,
  NanoBananaPromptIndexItem,
  NanoBananaPromptPage,
} from '../../shared/nanoBanana/types';
import { createNanoPromptId } from './nanoPromptStore';

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const toString = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value : fallback
);

const toOptionalString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value : null
);

const toNumber = (value: unknown, fallback = 0): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const toBoolean = (value: unknown, fallback = false): boolean => (
  typeof value === 'boolean' ? value : fallback
);

const toStringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
);

const getSourcePromptId = (item: Record<string, unknown>): string => {
  const rawId = item.id;
  if (typeof rawId === 'number' || typeof rawId === 'string') {
    return String(rawId);
  }
  return '';
};

export const normalizeNanoFeedMeta = (value: unknown): NanoBananaFeedMeta => {
  const record = toRecord(value);
  return {
    version: toString(record.version),
    lastUpdated: toString(record.lastUpdated),
    totalItems: toNumber(record.totalItems),
    itemsPerPage: toNumber(record.itemsPerPage),
    totalPages: toNumber(record.totalPages),
    totalCategories: toNumber(record.totalCategories),
    preRenderedPages: toNumber(record.preRenderedPages),
  };
};

export const normalizeNanoIndexItem = (
  value: unknown,
  sourceId = NanoBananaDefaultSourceId,
): NanoBananaPromptIndexItem | null => {
  const record = toRecord(value);
  const sourcePromptId = getSourcePromptId(record);
  if (!sourcePromptId) return null;
  return {
    id: createNanoPromptId(sourceId, sourcePromptId),
    sourceId,
    sourcePromptId,
    title: toString(record.title),
    description: toString(record.description),
    authorName: toString(record.authorName),
    categories: toStringArray(record.categories),
    publishedAt: toOptionalString(record.publishedAt),
    likes: toNumber(record.likes),
    resultsCount: toNumber(record.resultsCount),
    page: Math.max(1, Math.floor(toNumber(record.page, 1))),
    searchTerms: toString(record.searchTerms),
    thumbnailUrl: toOptionalString(record.thumbnailUrl),
    raw: value,
  };
};

export const normalizeNanoIndexItems = (
  value: unknown,
  sourceId = NanoBananaDefaultSourceId,
): NanoBananaPromptIndexItem[] => {
  const record = toRecord(value);
  const indexes = Array.isArray(record.indexes) ? record.indexes : [];
  return indexes
    .map((item) => normalizeNanoIndexItem(item, sourceId))
    .filter((item): item is NanoBananaPromptIndexItem => Boolean(item));
};

export const normalizeNanoPrompt = (
  value: unknown,
  sourceId = NanoBananaDefaultSourceId,
  page?: number | null,
): NanoBananaPrompt | null => {
  const record = toRecord(value);
  const sourcePromptId = getSourcePromptId(record);
  if (!sourcePromptId) return null;
  return {
    id: createNanoPromptId(sourceId, sourcePromptId),
    sourceId,
    sourcePromptId,
    title: toString(record.title),
    description: toString(record.description),
    content: toString(record.content),
    translatedContent: toOptionalString(record.translatedContent),
    sourceLink: toOptionalString(record.sourceLink),
    sourcePlatform: toOptionalString(record.sourcePlatform),
    sourcePublishedAt: toOptionalString(record.sourcePublishedAt),
    author: toRecord(record.author) as NanoBananaPrompt['author'],
    media: toStringArray(record.media),
    mediaThumbnails: toStringArray(record.mediaThumbnails),
    language: toString(record.language),
    searchIndex: toString(record.searchIndex),
    likes: toNumber(record.likes),
    resultsCount: toNumber(record.resultsCount),
    needReferenceImages: toBoolean(record.needReferenceImages),
    promptCategories: toStringArray(record.promptCategories),
    tags: toStringArray(record.tags),
    tagsZh: toStringArray(record.tags_zh),
    page: page ?? null,
    raw: value,
  };
};

export const normalizeNanoPromptPage = (
  value: unknown,
  sourceId = NanoBananaDefaultSourceId,
  etag?: string | null,
): { page: NanoBananaPromptPage; prompts: NanoBananaPrompt[] } | null => {
  const record = toRecord(value);
  const pageNumber = Math.max(1, Math.floor(toNumber(record.page, 1)));
  const items = Array.isArray(record.items) ? record.items : [];
  const prompts = items
    .map((item) => normalizeNanoPrompt(item, sourceId, pageNumber))
    .filter((item): item is NanoBananaPrompt => Boolean(item));
  return {
    page: {
      sourceId,
      page: pageNumber,
      totalPages: toNumber(record.totalPages),
      totalItems: toNumber(record.totalItems),
      hasNext: toBoolean(record.hasNext),
      hasPrev: toBoolean(record.hasPrev),
      itemCount: prompts.length,
      etag: etag ?? null,
      raw: value,
    },
    prompts,
  };
};
