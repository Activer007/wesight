import type { IpcMain } from 'electron';
import { beforeEach, expect, test, vi } from 'vitest';

import {
  NanoBananaDefaultSourceId,
  NanoBananaIpcChannel,
  NanoBananaPromptImportType,
  NanoBananaSourceStatus,
  NanoBananaUsageEventType,
} from '../../../shared/nanoBanana/constants';
import { normalizeNanoSearchIpcInput, registerNanoBananaIpcHandlers } from './handlers';

type RegisteredHandler = (_event: unknown, input?: unknown) => Promise<unknown> | unknown;

const handlers = new Map<string, RegisteredHandler>();

const ipcMain = {
  handle: vi.fn((channel: string, handler: RegisteredHandler) => {
    handlers.set(channel, handler);
  }),
} as unknown as IpcMain;

const syncService = {
  listSources: vi.fn(() => []),
  getStatus: vi.fn(() => ({
    status: NanoBananaSourceStatus.Ready,
    indexItemCount: 1,
    cachedPromptCount: 0,
    cachedPageCount: 0,
  })),
  sync: vi.fn(async () => ({ sourceId: NanoBananaDefaultSourceId, status: 'completed', warnings: [] })),
  getPrompt: vi.fn(async () => ({
    prompt: {
      id: 'nano-supai:1',
      sourceId: NanoBananaDefaultSourceId,
      sourcePromptId: '1',
      title: 'Prompt',
      content: 'Prompt text',
    },
    warnings: [],
  })),
  recordUsageEvent: vi.fn((input) => ({ id: 'usage-1', ...input, createdAt: 1 })),
};

const search = {
  search: vi.fn(() => ({ items: [], totalItems: 0, limit: 30, offset: 0 })),
};

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
});

test('registers Nano IPC handlers with constant channels', () => {
  registerNanoBananaIpcHandlers(ipcMain, () => syncService as never, () => search as never);

  expect(ipcMain.handle).toHaveBeenCalledWith(NanoBananaIpcChannel.SourceList, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(NanoBananaIpcChannel.SourceStatus, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(NanoBananaIpcChannel.Sync, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(NanoBananaIpcChannel.Search, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(NanoBananaIpcChannel.PromptGet, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(NanoBananaIpcChannel.PromptConvert, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(NanoBananaIpcChannel.UsageRecord, expect.any(Function));
});

test('clamps search IPC input', () => {
  const input = normalizeNanoSearchIpcInput({ query: 'portrait', limit: 1000, offset: -10 });
  expect(input.limit).toBe(100);
  expect(input.offset).toBe(0);
  expect(input.sourceId).toBe(NanoBananaDefaultSourceId);
});

test('handles search, prompt get, convert, and usage record requests', async () => {
  registerNanoBananaIpcHandlers(ipcMain, () => syncService as never, () => search as never);

  const searchResult = await handlers.get(NanoBananaIpcChannel.Search)?.({}, { limit: 999 });
  expect(searchResult).toMatchObject({ success: true, limit: 30, offset: 0 });
  expect(search.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));

  const promptResult = await handlers.get(NanoBananaIpcChannel.PromptGet)?.({}, { sourcePromptId: '1' });
  expect(promptResult).toMatchObject({ success: true, prompt: expect.objectContaining({ id: 'nano-supai:1' }) });

  const convertResult = await handlers.get(NanoBananaIpcChannel.PromptConvert)?.({}, { sourcePromptId: '1' });
  expect(convertResult).toMatchObject({ success: true, promptId: 'nano-supai:1' });

  const usageResult = await handlers.get(NanoBananaIpcChannel.UsageRecord)?.({}, {
    sourceId: NanoBananaDefaultSourceId,
    eventType: NanoBananaUsageEventType.Copy,
    importType: NanoBananaPromptImportType.Builder,
  });
  expect(usageResult).toMatchObject({ success: true, record: expect.objectContaining({ id: 'usage-1' }) });
});
