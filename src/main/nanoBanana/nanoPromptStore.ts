import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

import {
  DefaultNanoBananaPromptSource,
  isNanoBananaPromptImportType,
  isNanoBananaUsageEventType,
  NanoBananaDefaultSourceId,
  NanoBananaSourceStatus,
} from '../../shared/nanoBanana/constants';
import type {
  NanoBananaPrompt,
  NanoBananaPromptImportRecord,
  NanoBananaPromptIndexItem,
  NanoBananaPromptPage,
  NanoBananaPromptSource,
  NanoBananaSourceStatusSnapshot,
  NanoBananaUsageEventRecord,
} from '../../shared/nanoBanana/types';
import { ensureNanoPromptSchema } from './nanoPromptSchema';

interface SourceRow {
  id: string;
  name: string;
  base_url: string;
  source_type: string;
  enabled: number;
  last_synced_at: number | null;
  last_checked_at: number | null;
  last_updated_remote: string | null;
  total_items: number;
  total_pages: number;
  items_per_page: number;
  total_categories: number;
  pre_rendered_pages: number;
  etag_meta: string | null;
  etag_index: string | null;
  metadata_json: string;
  raw_json: string;
  created_at: number;
  updated_at: number;
}

interface IndexItemRow {
  id: string;
  source_id: string;
  source_prompt_id: string;
  title: string;
  description: string;
  author_name: string;
  categories_json: string;
  published_at: string | null;
  likes: number;
  results_count: number;
  page: number;
  search_terms: string;
  thumbnail_url: string | null;
  raw_json: string;
  created_at: number;
  updated_at: number;
}

interface PromptRow {
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
}

interface PageRow {
  source_id: string;
  page: number;
  total_pages: number;
  total_items: number;
  has_next: number;
  has_prev: number;
  item_count: number;
  etag: string | null;
  raw_json: string;
  fetched_at: number;
  updated_at: number;
}

const stringifyJson = (value: unknown): string => JSON.stringify(value ?? null);

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeSourcePromptId = (sourcePromptId: string | number): string => String(sourcePromptId);

export const createNanoPromptId = (
  sourceId: string,
  sourcePromptId: string | number,
): string => `${sourceId}:${normalizeSourcePromptId(sourcePromptId)}`;

const toSource = (row: SourceRow): NanoBananaPromptSource => ({
  id: row.id,
  name: row.name,
  baseUrl: row.base_url,
  sourceType: row.source_type as NanoBananaPromptSource['sourceType'],
  paths: parseJson(row.metadata_json, { paths: DefaultNanoBananaPromptSource.paths }).paths
    ?? DefaultNanoBananaPromptSource.paths,
  enabled: row.enabled === 1,
  lastSyncedAt: row.last_synced_at,
  lastCheckedAt: row.last_checked_at,
  lastUpdatedRemote: row.last_updated_remote,
  totalItems: row.total_items,
  totalPages: row.total_pages,
  itemsPerPage: row.items_per_page,
  totalCategories: row.total_categories,
  preRenderedPages: row.pre_rendered_pages,
  etagMeta: row.etag_meta,
  etagIndex: row.etag_index,
  metadata: parseJson(row.metadata_json, {}),
  raw: parseJson(row.raw_json, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toIndexItem = (row: IndexItemRow): NanoBananaPromptIndexItem => ({
  id: row.id,
  sourceId: row.source_id,
  sourcePromptId: row.source_prompt_id,
  title: row.title,
  description: row.description,
  authorName: row.author_name,
  categories: parseJson(row.categories_json, []),
  publishedAt: row.published_at,
  likes: row.likes,
  resultsCount: row.results_count,
  page: row.page,
  searchTerms: row.search_terms,
  thumbnailUrl: row.thumbnail_url,
  raw: parseJson(row.raw_json, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toPrompt = (row: PromptRow): NanoBananaPrompt => ({
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
});

const toPage = (row: PageRow): NanoBananaPromptPage => ({
  sourceId: row.source_id,
  page: row.page,
  totalPages: row.total_pages,
  totalItems: row.total_items,
  hasNext: row.has_next === 1,
  hasPrev: row.has_prev === 1,
  itemCount: row.item_count,
  etag: row.etag,
  raw: parseJson(row.raw_json, {}),
  fetchedAt: row.fetched_at,
  updatedAt: row.updated_at,
});

export class NanoPromptStore {
  constructor(private readonly db: Database.Database) {
    ensureNanoPromptSchema(db);
  }

  ensureDefaultSource(now = Date.now()): NanoBananaPromptSource {
    return this.upsertSource({
      id: DefaultNanoBananaPromptSource.id,
      name: DefaultNanoBananaPromptSource.name,
      baseUrl: DefaultNanoBananaPromptSource.baseUrl,
      sourceType: DefaultNanoBananaPromptSource.sourceType,
      paths: { ...DefaultNanoBananaPromptSource.paths },
      enabled: DefaultNanoBananaPromptSource.enabled,
      metadata: {
        paths: DefaultNanoBananaPromptSource.paths,
      },
      raw: DefaultNanoBananaPromptSource,
    }, now);
  }

  upsertSource(source: NanoBananaPromptSource, now = Date.now()): NanoBananaPromptSource {
    const existing = this.getSource(source.id);
    const createdAt = existing?.createdAt ?? now;
    const metadata = {
      ...(source.metadata ?? {}),
      paths: source.paths,
    };

    this.db.prepare(`
      INSERT INTO nano_sources (
        id,
        name,
        base_url,
        source_type,
        enabled,
        last_synced_at,
        last_checked_at,
        last_updated_remote,
        total_items,
        total_pages,
        items_per_page,
        total_categories,
        pre_rendered_pages,
        etag_meta,
        etag_index,
        metadata_json,
        raw_json,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @name,
        @baseUrl,
        @sourceType,
        @enabled,
        @lastSyncedAt,
        @lastCheckedAt,
        @lastUpdatedRemote,
        @totalItems,
        @totalPages,
        @itemsPerPage,
        @totalCategories,
        @preRenderedPages,
        @etagMeta,
        @etagIndex,
        @metadataJson,
        @rawJson,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        base_url = excluded.base_url,
        source_type = excluded.source_type,
        enabled = excluded.enabled,
        last_synced_at = excluded.last_synced_at,
        last_checked_at = excluded.last_checked_at,
        last_updated_remote = excluded.last_updated_remote,
        total_items = excluded.total_items,
        total_pages = excluded.total_pages,
        items_per_page = excluded.items_per_page,
        total_categories = excluded.total_categories,
        pre_rendered_pages = excluded.pre_rendered_pages,
        etag_meta = excluded.etag_meta,
        etag_index = excluded.etag_index,
        metadata_json = excluded.metadata_json,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
    `).run({
      id: source.id,
      name: source.name,
      baseUrl: source.baseUrl,
      sourceType: source.sourceType,
      enabled: source.enabled ? 1 : 0,
      lastSyncedAt: source.lastSyncedAt ?? null,
      lastCheckedAt: source.lastCheckedAt ?? null,
      lastUpdatedRemote: source.lastUpdatedRemote ?? null,
      totalItems: source.totalItems ?? 0,
      totalPages: source.totalPages ?? 0,
      itemsPerPage: source.itemsPerPage ?? 0,
      totalCategories: source.totalCategories ?? 0,
      preRenderedPages: source.preRenderedPages ?? 0,
      etagMeta: source.etagMeta ?? null,
      etagIndex: source.etagIndex ?? null,
      metadataJson: stringifyJson(metadata),
      rawJson: stringifyJson(source.raw ?? {}),
      createdAt,
      updatedAt: now,
    });

    const updated = this.getSource(source.id);
    if (!updated) {
      throw new Error('Nano source upsert failed');
    }
    return updated;
  }

  getSource(sourceId = NanoBananaDefaultSourceId): NanoBananaPromptSource | null {
    const row = this.db
      .prepare('SELECT * FROM nano_sources WHERE id = ?')
      .get(sourceId) as SourceRow | undefined;
    return row ? toSource(row) : null;
  }

  listSources(): NanoBananaPromptSource[] {
    const rows = this.db
      .prepare('SELECT * FROM nano_sources ORDER BY id')
      .all() as SourceRow[];
    return rows.map(toSource);
  }

  upsertIndexItems(items: NanoBananaPromptIndexItem[], now = Date.now()): number {
    const statement = this.db.prepare(`
      INSERT INTO nano_prompt_index_items (
        id,
        source_id,
        source_prompt_id,
        title,
        description,
        author_name,
        categories_json,
        published_at,
        likes,
        results_count,
        page,
        search_terms,
        thumbnail_url,
        raw_json,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @sourceId,
        @sourcePromptId,
        @title,
        @description,
        @authorName,
        @categoriesJson,
        @publishedAt,
        @likes,
        @resultsCount,
        @page,
        @searchTerms,
        @thumbnailUrl,
        @rawJson,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        author_name = excluded.author_name,
        categories_json = excluded.categories_json,
        published_at = excluded.published_at,
        likes = excluded.likes,
        results_count = excluded.results_count,
        page = excluded.page,
        search_terms = excluded.search_terms,
        thumbnail_url = excluded.thumbnail_url,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
    `);

    const insertMany = this.db.transaction((records: NanoBananaPromptIndexItem[]) => {
      records.forEach((item) => {
        const existing = this.getIndexItem(item.id);
        statement.run({
          id: item.id,
          sourceId: item.sourceId,
          sourcePromptId: item.sourcePromptId,
          title: item.title,
          description: item.description,
          authorName: item.authorName,
          categoriesJson: stringifyJson(item.categories),
          publishedAt: item.publishedAt,
          likes: item.likes,
          resultsCount: item.resultsCount,
          page: item.page,
          searchTerms: item.searchTerms,
          thumbnailUrl: item.thumbnailUrl,
          rawJson: stringifyJson(item.raw),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      });
    });

    insertMany(items);
    return items.length;
  }

  getIndexItem(id: string): NanoBananaPromptIndexItem | null {
    const row = this.db
      .prepare('SELECT * FROM nano_prompt_index_items WHERE id = ?')
      .get(id) as IndexItemRow | undefined;
    return row ? toIndexItem(row) : null;
  }

  getIndexItemBySourcePromptId(
    sourceId: string,
    sourcePromptId: string | number,
  ): NanoBananaPromptIndexItem | null {
    const row = this.db
      .prepare('SELECT * FROM nano_prompt_index_items WHERE source_id = ? AND source_prompt_id = ?')
      .get(sourceId, normalizeSourcePromptId(sourcePromptId)) as IndexItemRow | undefined;
    return row ? toIndexItem(row) : null;
  }

  listIndexItems(sourceId = NanoBananaDefaultSourceId, limit = 100, offset = 0): NanoBananaPromptIndexItem[] {
    const rows = this.db
      .prepare(`
        SELECT *
        FROM nano_prompt_index_items
        WHERE source_id = ?
        ORDER BY published_at DESC, id DESC
        LIMIT ? OFFSET ?
      `)
      .all(sourceId, limit, offset) as IndexItemRow[];
    return rows.map(toIndexItem);
  }

  upsertPage(page: NanoBananaPromptPage, now = Date.now()): NanoBananaPromptPage {
    this.db.prepare(`
      INSERT INTO nano_prompt_pages (
        source_id,
        page,
        total_pages,
        total_items,
        has_next,
        has_prev,
        item_count,
        etag,
        raw_json,
        fetched_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, page) DO UPDATE SET
        total_pages = excluded.total_pages,
        total_items = excluded.total_items,
        has_next = excluded.has_next,
        has_prev = excluded.has_prev,
        item_count = excluded.item_count,
        etag = excluded.etag,
        raw_json = excluded.raw_json,
        fetched_at = excluded.fetched_at,
        updated_at = excluded.updated_at
    `).run(
      page.sourceId,
      page.page,
      page.totalPages,
      page.totalItems,
      page.hasNext ? 1 : 0,
      page.hasPrev ? 1 : 0,
      page.itemCount,
      page.etag ?? null,
      stringifyJson(page.raw),
      page.fetchedAt ?? now,
      now,
    );

    const updated = this.getPage(page.sourceId, page.page);
    if (!updated) {
      throw new Error('Nano page upsert failed');
    }
    return updated;
  }

  getPage(sourceId: string, page: number): NanoBananaPromptPage | null {
    const row = this.db
      .prepare('SELECT * FROM nano_prompt_pages WHERE source_id = ? AND page = ?')
      .get(sourceId, page) as PageRow | undefined;
    return row ? toPage(row) : null;
  }

  upsertPrompts(prompts: NanoBananaPrompt[], now = Date.now()): number {
    const statement = this.db.prepare(`
      INSERT INTO nano_prompts (
        id,
        source_id,
        source_prompt_id,
        title,
        description,
        content,
        translated_content,
        source_link,
        source_platform,
        source_published_at,
        author_json,
        media_json,
        media_thumbnails_json,
        language,
        search_index,
        likes,
        results_count,
        need_reference_images,
        prompt_categories_json,
        tags_json,
        tags_zh_json,
        page,
        raw_json,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @sourceId,
        @sourcePromptId,
        @title,
        @description,
        @content,
        @translatedContent,
        @sourceLink,
        @sourcePlatform,
        @sourcePublishedAt,
        @authorJson,
        @mediaJson,
        @mediaThumbnailsJson,
        @language,
        @searchIndex,
        @likes,
        @resultsCount,
        @needReferenceImages,
        @promptCategoriesJson,
        @tagsJson,
        @tagsZhJson,
        @page,
        @rawJson,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        content = excluded.content,
        translated_content = excluded.translated_content,
        source_link = excluded.source_link,
        source_platform = excluded.source_platform,
        source_published_at = excluded.source_published_at,
        author_json = excluded.author_json,
        media_json = excluded.media_json,
        media_thumbnails_json = excluded.media_thumbnails_json,
        language = excluded.language,
        search_index = excluded.search_index,
        likes = excluded.likes,
        results_count = excluded.results_count,
        need_reference_images = excluded.need_reference_images,
        prompt_categories_json = excluded.prompt_categories_json,
        tags_json = excluded.tags_json,
        tags_zh_json = excluded.tags_zh_json,
        page = excluded.page,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
    `);

    const insertMany = this.db.transaction((records: NanoBananaPrompt[]) => {
      records.forEach((prompt) => {
        const existing = this.getPrompt(prompt.id);
        statement.run({
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
          authorJson: stringifyJson(prompt.author ?? {}),
          mediaJson: stringifyJson(prompt.media),
          mediaThumbnailsJson: stringifyJson(prompt.mediaThumbnails),
          language: prompt.language,
          searchIndex: prompt.searchIndex,
          likes: prompt.likes,
          resultsCount: prompt.resultsCount,
          needReferenceImages: prompt.needReferenceImages ? 1 : 0,
          promptCategoriesJson: stringifyJson(prompt.promptCategories),
          tagsJson: stringifyJson(prompt.tags),
          tagsZhJson: stringifyJson(prompt.tagsZh),
          page: prompt.page ?? null,
          rawJson: stringifyJson(prompt.raw),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      });
    });

    insertMany(prompts);
    return prompts.length;
  }

  getPrompt(id: string): NanoBananaPrompt | null {
    const row = this.db
      .prepare('SELECT * FROM nano_prompts WHERE id = ?')
      .get(id) as PromptRow | undefined;
    return row ? toPrompt(row) : null;
  }

  getPromptBySourcePromptId(
    sourceId: string,
    sourcePromptId: string | number,
  ): NanoBananaPrompt | null {
    return this.getPrompt(createNanoPromptId(sourceId, sourcePromptId));
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  getStatus(sourceId = NanoBananaDefaultSourceId): NanoBananaSourceStatusSnapshot | null {
    const source = this.getSource(sourceId);
    if (!source) return null;

    const indexItemCount = this.db
      .prepare('SELECT COUNT(*) AS count FROM nano_prompt_index_items WHERE source_id = ?')
      .get(sourceId) as { count: number };
    const cachedPromptCount = this.db
      .prepare('SELECT COUNT(*) AS count FROM nano_prompts WHERE source_id = ?')
      .get(sourceId) as { count: number };
    const cachedPageCount = this.db
      .prepare('SELECT COUNT(*) AS count FROM nano_prompt_pages WHERE source_id = ?')
      .get(sourceId) as { count: number };

    const status = indexItemCount.count > 0
      ? NanoBananaSourceStatus.Ready
      : NanoBananaSourceStatus.Empty;

    return {
      source,
      status,
      indexItemCount: indexItemCount.count,
      cachedPromptCount: cachedPromptCount.count,
      cachedPageCount: cachedPageCount.count,
      lastError: null,
    };
  }

  recordImport(
    input: Omit<NanoBananaPromptImportRecord, 'id' | 'createdAt'> & Partial<Pick<NanoBananaPromptImportRecord, 'id' | 'createdAt'>>,
    now = Date.now(),
  ): NanoBananaPromptImportRecord {
    if (!isNanoBananaPromptImportType(input.importType)) {
      throw new Error('Invalid Nano prompt import type');
    }

    const record: NanoBananaPromptImportRecord = {
      id: input.id ?? randomUUID(),
      sourceId: input.sourceId,
      promptId: input.promptId,
      sourcePromptId: input.sourcePromptId,
      importType: input.importType,
      projectId: input.projectId ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? now,
    };

    this.db.prepare(`
      INSERT INTO nano_prompt_imports (
        id,
        source_id,
        prompt_id,
        source_prompt_id,
        import_type,
        project_id,
        target_id,
        metadata_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.sourceId,
      record.promptId,
      record.sourcePromptId,
      record.importType,
      record.projectId,
      record.targetId,
      stringifyJson(record.metadata),
      record.createdAt,
    );

    return record;
  }

  recordUsageEvent(
    input: Omit<NanoBananaUsageEventRecord, 'id' | 'createdAt'> & Partial<Pick<NanoBananaUsageEventRecord, 'id' | 'createdAt'>>,
    now = Date.now(),
  ): NanoBananaUsageEventRecord {
    if (!isNanoBananaUsageEventType(input.eventType)) {
      throw new Error('Invalid Nano usage event type');
    }
    if (input.importType !== null && input.importType !== undefined && !isNanoBananaPromptImportType(input.importType)) {
      throw new Error('Invalid Nano prompt import type');
    }

    const record: NanoBananaUsageEventRecord = {
      id: input.id ?? randomUUID(),
      sourceId: input.sourceId,
      promptId: input.promptId ?? null,
      sourcePromptId: input.sourcePromptId ?? null,
      eventType: input.eventType,
      importType: input.importType ?? null,
      projectId: input.projectId ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? now,
    };

    this.db.prepare(`
      INSERT INTO nano_prompt_usage_events (
        id,
        source_id,
        prompt_id,
        source_prompt_id,
        event_type,
        import_type,
        project_id,
        target_id,
        metadata_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.sourceId,
      record.promptId,
      record.sourcePromptId,
      record.eventType,
      record.importType,
      record.projectId,
      record.targetId,
      stringifyJson(record.metadata),
      record.createdAt,
    );

    return record;
  }
}
