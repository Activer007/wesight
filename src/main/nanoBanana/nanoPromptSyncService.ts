import {
  NanoBananaDefaultSourceId,
  NanoBananaSyncStatus,
} from '../../shared/nanoBanana/constants';
import type {
  NanoBananaImportRecordInput,
  NanoBananaPrompt,
  NanoBananaPromptGetInput,
  NanoBananaPromptGetResult,
  NanoBananaPromptImportRecord,
  NanoBananaPromptSource,
  NanoBananaSyncInput,
  NanoBananaSyncResult,
  NanoBananaUsageEventRecord,
  NanoBananaUsageRecordInput,
} from '../../shared/nanoBanana/types';
import {
  normalizeNanoFeedMeta,
  normalizeNanoIndexItems,
  normalizeNanoPromptPage,
} from './nanoPromptNormalizer';
import { createNanoPromptId, NanoPromptStore } from './nanoPromptStore';
import { NanoRemoteJsonClient } from './nanoRemoteJsonClient';

export class NanoPromptSyncService {
  constructor(
    private readonly store: NanoPromptStore,
    private readonly client = new NanoRemoteJsonClient(),
  ) {}

  getStatus(sourceId = NanoBananaDefaultSourceId) {
    this.store.ensureDefaultSource();
    return this.store.getStatus(sourceId);
  }

  listSources() {
    this.store.ensureDefaultSource();
    return this.store.listSources();
  }

  async sync(input: NanoBananaSyncInput = {}): Promise<NanoBananaSyncResult> {
    const now = Date.now();
    const sourceId = input.sourceId || NanoBananaDefaultSourceId;
    const force = input.force === true || input.mode === 'force';
    const warnings: string[] = [];
    let source = this.store.getSource(sourceId) ?? this.store.ensureDefaultSource(now);
    let metaChanged = force;

    try {
      const metaResponse = await this.client.fetchMeta<unknown>(source, force ? null : source.etagMeta);
      if (metaResponse.notModified) {
        this.store.upsertSource({
          ...source,
          lastCheckedAt: now,
          etagMeta: metaResponse.etag ?? source.etagMeta,
        }, now);
        const status = this.store.getStatus(sourceId);
        return {
          sourceId,
          status: NanoBananaSyncStatus.Skipped,
          checkedAt: now,
          syncedAt: source.lastSyncedAt ?? null,
          metaChanged: false,
          indexItemCount: status?.indexItemCount ?? 0,
          pageCount: status?.cachedPageCount ?? 0,
          warnings,
        };
      }

      const meta = normalizeNanoFeedMeta(metaResponse.data);
      metaChanged = force
        || meta.version !== (source.raw as { version?: string } | undefined)?.version
        || meta.lastUpdated !== source.lastUpdatedRemote
        || meta.totalItems !== source.totalItems;

      source = this.store.upsertSource({
        ...source,
        lastCheckedAt: now,
        lastUpdatedRemote: meta.lastUpdated,
        totalItems: meta.totalItems,
        totalPages: meta.totalPages,
        itemsPerPage: meta.itemsPerPage,
        totalCategories: meta.totalCategories ?? 0,
        preRenderedPages: meta.preRenderedPages ?? 0,
        etagMeta: metaResponse.etag ?? source.etagMeta,
        raw: metaResponse.data,
      }, now);

      const currentStatus = this.store.getStatus(sourceId);
      if (!metaChanged && currentStatus && currentStatus.indexItemCount > 0) {
        return {
          sourceId,
          status: NanoBananaSyncStatus.Skipped,
          checkedAt: now,
          syncedAt: source.lastSyncedAt ?? null,
          metaChanged: false,
          indexItemCount: currentStatus.indexItemCount,
          pageCount: currentStatus.cachedPageCount,
          warnings,
        };
      }

      const indexResponse = await this.client.fetchIndex<unknown>(source, force ? null : source.etagIndex);
      if (indexResponse.notModified) {
        const updated = this.store.upsertSource({
          ...source,
          lastSyncedAt: now,
          etagIndex: indexResponse.etag ?? source.etagIndex,
        }, now);
        const status = this.store.getStatus(sourceId);
        return {
          sourceId: updated.id,
          status: NanoBananaSyncStatus.Skipped,
          checkedAt: now,
          syncedAt: now,
          metaChanged,
          indexItemCount: status?.indexItemCount ?? 0,
          pageCount: status?.cachedPageCount ?? 0,
          warnings,
        };
      }

      const indexItems = normalizeNanoIndexItems(indexResponse.data, sourceId);
      this.store.upsertIndexItems(indexItems, now);
      this.store.upsertSource({
        ...source,
        lastSyncedAt: now,
        etagIndex: indexResponse.etag ?? source.etagIndex,
      }, now);
      const status = this.store.getStatus(sourceId);
      return {
        sourceId,
        status: NanoBananaSyncStatus.Completed,
        checkedAt: now,
        syncedAt: now,
        metaChanged,
        indexItemCount: status?.indexItemCount ?? indexItems.length,
        pageCount: status?.cachedPageCount ?? 0,
        warnings,
      };
    } catch (error) {
      const status = this.store.getStatus(sourceId);
      const errorMessage = error instanceof Error ? error.message : 'Nano sync failed';
      if (status && status.indexItemCount > 0) {
        warnings.push(errorMessage);
        return {
          sourceId,
          status: NanoBananaSyncStatus.PartialFailed,
          checkedAt: now,
          syncedAt: source.lastSyncedAt ?? null,
          metaChanged,
          indexItemCount: status.indexItemCount,
          pageCount: status.cachedPageCount,
          warnings,
          error: errorMessage,
        };
      }
      return {
        sourceId,
        status: NanoBananaSyncStatus.Failed,
        checkedAt: now,
        syncedAt: null,
        metaChanged,
        indexItemCount: 0,
        pageCount: 0,
        warnings,
        error: errorMessage,
      };
    }
  }

  async getPrompt(input: NanoBananaPromptGetInput): Promise<NanoBananaPromptGetResult> {
    const sourceId = input.sourceId || NanoBananaDefaultSourceId;
    const sourcePromptId = input.sourcePromptId !== undefined && input.sourcePromptId !== null
      ? String(input.sourcePromptId)
      : input.promptId?.startsWith(`${sourceId}:`)
        ? input.promptId.slice(sourceId.length + 1)
        : null;
    const promptId = input.promptId || (sourcePromptId ? createNanoPromptId(sourceId, sourcePromptId) : null);
    const warnings: string[] = [];

    this.store.ensureDefaultSource();
    if (!promptId && !sourcePromptId) {
      return { prompt: null, warnings: ['promptId or sourcePromptId is required'] };
    }

    const cachedPrompt = promptId ? this.store.getPrompt(promptId) : null;
    if (cachedPrompt) {
      return {
        prompt: cachedPrompt,
        indexItem: this.store.getIndexItem(cachedPrompt.id),
        warnings,
      };
    }

    const indexItem = promptId
      ? this.store.getIndexItem(promptId)
      : this.store.getIndexItemBySourcePromptId(sourceId, sourcePromptId!);
    if (!indexItem) {
      return { prompt: null, indexItem: null, warnings: ['Prompt index item was not found'] };
    }

    const source = this.store.getSource(sourceId);
    if (!source) {
      return { prompt: null, indexItem, warnings: ['Nano source was not found'] };
    }

    await this.fetchAndCachePage(source, indexItem.page, warnings);
    const prompt = this.store.getPrompt(indexItem.id);
    return {
      prompt,
      indexItem,
      warnings,
    };
  }

  recordUsageEvent(input: NanoBananaUsageRecordInput): NanoBananaUsageEventRecord {
    this.store.ensureDefaultSource();
    return this.store.recordUsageEvent(input);
  }

  recordImport(input: NanoBananaImportRecordInput): NanoBananaPromptImportRecord {
    this.store.ensureDefaultSource();
    return this.store.recordImport(input);
  }

  async fetchAndCachePage(
    source: NanoBananaPromptSource,
    pageNumber: number,
    warnings: string[] = [],
  ): Promise<NanoBananaPrompt[]> {
    const now = Date.now();
    const cachedPage = this.store.getPage(source.id, pageNumber);
    try {
      const response = await this.client.fetchPage<unknown>(source, pageNumber, cachedPage?.etag);
      if (response.notModified) {
        return [];
      }
      const normalized = normalizeNanoPromptPage(response.data, source.id, response.etag);
      if (!normalized) {
        warnings.push('Nano page could not be normalized');
        return [];
      }
      this.store.upsertPage(normalized.page, now);
      this.store.upsertPrompts(normalized.prompts, now);
      return normalized.prompts;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Nano page fetch failed');
      return [];
    }
  }
}
