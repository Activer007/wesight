import fs from 'fs';
import path from 'path';

import type {
  NanoBananaPrompt,
  NanoBananaPromptIndexItem,
  NanoBananaPromptSource,
  NanoBananaSourceStatusSnapshot,
} from '../../shared/nanoBanana/types';
import { NanoPromptStore } from './nanoPromptStore';

const CacheVersion = 1;
const CacheDirName = 'NanoBanana';
const CacheSubdirName = 'cache';

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const stringifyJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const getPromptCacheFileName = (promptId: string): string => (
  encodeURIComponent(promptId).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`) + '.json'
);

const toPublicSource = (source: NanoBananaPromptSource | null) => (
  source
    ? {
      id: source.id,
      name: source.name,
      baseUrl: source.baseUrl,
      sourceType: source.sourceType,
      lastSyncedAt: source.lastSyncedAt ?? null,
      lastUpdatedRemote: source.lastUpdatedRemote ?? null,
      totalItems: source.totalItems ?? 0,
      totalPages: source.totalPages ?? 0,
      itemsPerPage: source.itemsPerPage ?? 0,
    }
    : null
);

const toPublicIndexItem = (item: NanoBananaPromptIndexItem) => ({
  id: item.id,
  sourceId: item.sourceId,
  sourcePromptId: item.sourcePromptId,
  title: item.title,
  description: item.description,
  authorName: item.authorName,
  categories: item.categories,
  publishedAt: item.publishedAt,
  likes: item.likes,
  resultsCount: item.resultsCount,
  page: item.page,
  searchTerms: item.searchTerms,
  thumbnailUrl: item.thumbnailUrl,
  needReferenceImages: item.needReferenceImages ?? null,
  updatedAt: item.updatedAt ?? null,
});

const toPublicPrompt = (prompt: NanoBananaPrompt) => ({
  id: prompt.id,
  sourceId: prompt.sourceId,
  sourcePromptId: prompt.sourcePromptId,
  title: prompt.title,
  description: prompt.description,
  content: prompt.content,
  translatedContent: prompt.translatedContent ?? null,
  sourceLink: prompt.sourceLink ?? null,
  sourcePlatform: prompt.sourcePlatform ?? null,
  sourcePublishedAt: prompt.sourcePublishedAt ?? null,
  author: prompt.author ?? null,
  media: prompt.media,
  mediaThumbnails: prompt.mediaThumbnails,
  language: prompt.language,
  searchIndex: prompt.searchIndex,
  likes: prompt.likes,
  resultsCount: prompt.resultsCount,
  needReferenceImages: prompt.needReferenceImages,
  promptCategories: prompt.promptCategories,
  tags: prompt.tags,
  tagsZh: prompt.tagsZh,
  page: prompt.page ?? null,
  updatedAt: prompt.updatedAt ?? null,
});

export class NanoPromptCacheExporter {
  constructor(
    private readonly store: NanoPromptStore,
    private readonly userDataPath: string,
  ) {}

  getCacheDir(): string {
    return path.join(this.userDataPath, CacheDirName, CacheSubdirName);
  }

  exportSource(sourceId: string): void {
    const status = this.store.getStatus(sourceId);
    const source = status?.source ?? this.store.getSource(sourceId);
    const indexItems = this.store.listIndexItems(sourceId, Number.MAX_SAFE_INTEGER, 0);
    const prompts = this.listPrompts(sourceId);
    const promptFileMap = Object.fromEntries(prompts.map((prompt) => [
      prompt.id,
      `prompts/${getPromptCacheFileName(prompt.id)}`,
    ]));

    const cacheDir = this.getCacheDir();
    const promptsDir = path.join(cacheDir, 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });

    prompts.forEach((prompt) => {
      fs.writeFileSync(
        path.join(promptsDir, getPromptCacheFileName(prompt.id)),
        stringifyJson(toPublicPrompt(prompt)),
        'utf8',
      );
    });

    fs.writeFileSync(
      path.join(cacheDir, 'index.json'),
      stringifyJson({
        schemaVersion: CacheVersion,
        exportedAt: Date.now(),
        source: toPublicSource(source),
        status: this.toPublicStatus(status),
        itemCount: indexItems.length,
        cachedPromptCount: prompts.length,
        promptFiles: promptFileMap,
        indexItems: indexItems.map(toPublicIndexItem),
      }),
      'utf8',
    );
  }

  private listPrompts(sourceId: string): NanoBananaPrompt[] {
    const rows = this.store.getDatabase()
      .prepare('SELECT * FROM nano_prompts WHERE source_id = ? ORDER BY updated_at DESC, id DESC')
      .all(sourceId) as Array<{
        id: string;
        source_id: string;
        source_prompt_id: string;
        title: string;
        description: string;
        content: string;
        translated_content: string | null;
        source_link: string | null;
        source_platform: string | null;
        source_published_at: string | null;
        author_json: string;
        media_json: string;
        media_thumbnails_json: string;
        language: string;
        search_index: string;
        likes: number;
        results_count: number;
        need_reference_images: number;
        prompt_categories_json: string;
        tags_json: string;
        tags_zh_json: string;
        page: number | null;
        raw_json: string;
        created_at: number;
        updated_at: number;
      }>;

    return rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      sourcePromptId: row.source_prompt_id,
      title: row.title,
      description: row.description,
      content: row.content,
      translatedContent: row.translated_content,
      sourceLink: row.source_link,
      sourcePlatform: row.source_platform,
      sourcePublishedAt: row.source_published_at,
      author: parseJson(row.author_json, null),
      media: parseJson(row.media_json, []),
      mediaThumbnails: parseJson(row.media_thumbnails_json, []),
      language: row.language,
      searchIndex: row.search_index,
      likes: row.likes,
      resultsCount: row.results_count,
      needReferenceImages: row.need_reference_images === 1,
      promptCategories: parseJson(row.prompt_categories_json, []),
      tags: parseJson(row.tags_json, []),
      tagsZh: parseJson(row.tags_zh_json, []),
      page: row.page,
      raw: parseJson(row.raw_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private toPublicStatus(status: NanoBananaSourceStatusSnapshot | null) {
    return status
      ? {
        status: status.status,
        indexItemCount: status.indexItemCount,
        cachedPromptCount: status.cachedPromptCount,
        cachedPageCount: status.cachedPageCount,
        lastError: status.lastError ?? null,
      }
      : null;
  }
}
