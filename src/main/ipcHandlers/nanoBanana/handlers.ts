import type { IpcMain } from 'electron';

import {
  isNanoBananaPromptImportType,
  isNanoBananaSearchSort,
  isNanoBananaUsageEventType,
  NanoBananaDefaultSourceId,
  NanoBananaIpcChannel,
  NanoBananaPromptImportType,
  NanoBananaSearchSort,
  NanoBananaUsageEventType,
} from '../../../shared/nanoBanana/constants';
import type {
  NanoBananaPromptGetInput,
  NanoBananaSearchInput,
  NanoBananaSyncInput,
  NanoBananaUsageRecordInput,
} from '../../../shared/nanoBanana/types';
import type { NanoPromptSearch } from '../../nanoBanana/nanoPromptSearch';
import type { NanoPromptSyncService } from '../../nanoBanana/nanoPromptSyncService';

type NanoBananaIpcResponse<T = Record<string, never>> = {
  success: boolean;
  error?: string;
} & Partial<T>;

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const toTrimmedString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const normalizeStringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
    : []
);

export const normalizeNanoSearchIpcInput = (input: unknown): NanoBananaSearchInput => {
  const record = toRecord(input);
  const limit = typeof record.limit === 'number' && Number.isFinite(record.limit)
    ? Math.max(1, Math.min(Math.floor(record.limit), 100))
    : 30;
  const offset = typeof record.offset === 'number' && Number.isFinite(record.offset)
    ? Math.max(0, Math.floor(record.offset))
    : 0;
  return {
    sourceId: toTrimmedString(record.sourceId) ?? NanoBananaDefaultSourceId,
    query: toTrimmedString(record.query) ?? '',
    categories: normalizeStringArray(record.categories),
    tags: normalizeStringArray(record.tags),
    ...(typeof record.needReferenceImages === 'boolean' ? { needReferenceImages: record.needReferenceImages } : {}),
    sort: isNanoBananaSearchSort(record.sort)
      ? record.sort
      : toTrimmedString(record.query)
        ? NanoBananaSearchSort.Relevance
        : NanoBananaSearchSort.PublishedDesc,
    limit,
    offset,
  };
};

const normalizeSyncInput = (input: unknown): NanoBananaSyncInput => {
  const record = toRecord(input);
  const force = record.force === true || record.mode === 'force';
  return {
    sourceId: toTrimmedString(record.sourceId) ?? NanoBananaDefaultSourceId,
    force,
    mode: force ? 'force' : 'manual',
  };
};

const normalizePromptGetInput = (input: unknown): NanoBananaPromptGetInput | null => {
  const record = toRecord(input);
  const sourceId = toTrimmedString(record.sourceId) ?? NanoBananaDefaultSourceId;
  const promptId = toTrimmedString(record.promptId);
  const sourcePromptId = toTrimmedString(record.sourcePromptId)
    ?? (typeof record.sourcePromptId === 'number' ? String(record.sourcePromptId) : null);
  if (!promptId && !sourcePromptId) return null;
  return {
    sourceId,
    ...(promptId ? { promptId } : {}),
    ...(sourcePromptId ? { sourcePromptId } : {}),
  };
};

const normalizeUsageInput = (input: unknown): NanoBananaUsageRecordInput | null => {
  const record = toRecord(input);
  const sourceId = toTrimmedString(record.sourceId) ?? NanoBananaDefaultSourceId;
  if (!isNanoBananaUsageEventType(record.eventType)) return null;
  const importType = isNanoBananaPromptImportType(record.importType) ? record.importType : null;
  return {
    sourceId,
    promptId: toTrimmedString(record.promptId),
    sourcePromptId: toTrimmedString(record.sourcePromptId),
    eventType: record.eventType,
    importType,
    projectId: toTrimmedString(record.projectId),
    targetId: toTrimmedString(record.targetId),
    metadata: toRecord(record.metadata),
  };
};

export const registerNanoBananaIpcHandlers = (
  ipcMain: IpcMain,
  getSyncService: () => NanoPromptSyncService,
  getSearch: () => NanoPromptSearch,
): void => {
  ipcMain.handle(NanoBananaIpcChannel.SourceList, async (): Promise<NanoBananaIpcResponse<{ sources: ReturnType<NanoPromptSyncService['listSources']> }>> => {
    try {
      return { success: true, sources: getSyncService().listSources() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list Nano sources' };
    }
  });

  ipcMain.handle(NanoBananaIpcChannel.SourceStatus, async (_event, input: unknown) => {
    try {
      const sourceId = toTrimmedString(toRecord(input).sourceId) ?? NanoBananaDefaultSourceId;
      const status = getSyncService().getStatus(sourceId);
      return { success: true, status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get Nano source status' };
    }
  });

  ipcMain.handle(NanoBananaIpcChannel.Sync, async (_event, input: unknown) => {
    try {
      const result = await getSyncService().sync(normalizeSyncInput(input));
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to sync Nano prompts' };
    }
  });

  ipcMain.handle(NanoBananaIpcChannel.Search, async (_event, input: unknown) => {
    try {
      const result = getSearch().search(normalizeNanoSearchIpcInput(input));
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search Nano prompts' };
    }
  });

  ipcMain.handle(NanoBananaIpcChannel.PromptGet, async (_event, input: unknown) => {
    try {
      const normalized = normalizePromptGetInput(input);
      if (!normalized) return { success: false, error: 'promptId or sourcePromptId is required' };
      const result = await getSyncService().getPrompt(normalized);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get Nano prompt' };
    }
  });

  ipcMain.handle(NanoBananaIpcChannel.PromptConvert, async (_event, input: unknown) => {
    try {
      const normalized = normalizePromptGetInput(input);
      if (!normalized) return { success: false, error: 'promptId or sourcePromptId is required' };
      const result = await getSyncService().getPrompt(normalized);
      if (!result.prompt) return { success: false, error: 'Nano prompt not found' };
      return {
        success: true,
        sourceId: result.prompt.sourceId,
        promptId: result.prompt.id,
        sourcePromptId: result.prompt.sourcePromptId,
        promptSpec: {
          source: 'nano_banana',
          title: result.prompt.title,
          promptText: result.prompt.content,
          translatedText: result.prompt.translatedContent,
          provenance: {
            nano: {
              sourceId: result.prompt.sourceId,
              sourcePromptId: result.prompt.sourcePromptId,
              sourceLink: result.prompt.sourceLink,
              sourcePlatform: result.prompt.sourcePlatform,
              author: result.prompt.author,
            },
          },
        },
        warnings: result.warnings,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to convert Nano prompt' };
    }
  });

  ipcMain.handle(NanoBananaIpcChannel.UsageRecord, async (_event, input: unknown) => {
    try {
      const normalized = normalizeUsageInput(input);
      if (!normalized) return { success: false, error: 'valid eventType is required' };
      const record = getSyncService().recordUsageEvent({
        sourceId: normalized.sourceId,
        promptId: normalized.promptId ?? null,
        sourcePromptId: normalized.sourcePromptId ?? null,
        eventType: normalized.eventType ?? NanoBananaUsageEventType.View,
        importType: normalized.importType ?? NanoBananaPromptImportType.Builder,
        projectId: normalized.projectId ?? null,
        targetId: normalized.targetId ?? null,
        metadata: normalized.metadata ?? {},
      });
      return { success: true, record };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to record Nano usage event' };
    }
  });
};
