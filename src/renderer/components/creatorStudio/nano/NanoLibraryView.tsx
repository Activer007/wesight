import { ExclamationTriangleIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import {
  NanoBananaDefaultSourceId,
  NanoBananaSearchSort,
  NanoBananaSourceStatus,
  NanoBananaSyncStatus,
  NanoBananaUsageEventType,
} from '@shared/nanoBanana/constants';
import type {
  NanoBananaPrompt,
  NanoBananaPromptIndexItem,
  NanoBananaSearchInput,
  NanoBananaSourceStatusSnapshot,
} from '@shared/nanoBanana/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { i18nService } from '../../../services/i18n';
import { nanoBananaService } from '../../../services/nanoBanana';
import { NanoPromptCard } from './NanoPromptCard';
import { NanoPromptDetailDrawer } from './NanoPromptDetailDrawer';
import { NanoPromptFilters } from './NanoPromptFilters';

const PageSize = 30;

const defaultFilters: NanoBananaSearchInput = {
  sourceId: NanoBananaDefaultSourceId,
  query: '',
  categories: [],
  tags: [],
  needReferenceImages: false,
  sort: NanoBananaSearchSort.PublishedDesc,
  limit: PageSize,
  offset: 0,
};

const dispatchToast = (message: string) => {
  window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
};

const formatTime = (value: number | null | undefined): string => {
  if (!value) return i18nService.t('nanoLibraryNeverSynced');
  return new Intl.DateTimeFormat(i18nService.getLanguage() === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getStatusLabel = (status: NanoBananaSourceStatusSnapshot | null, hasItems: boolean): string => {
  if (!status) return i18nService.t('nanoLibraryStatusUnknown');
  if (status.status === NanoBananaSourceStatus.Empty) return i18nService.t('nanoLibraryStatusEmpty');
  if (status.status === NanoBananaSourceStatus.Error && hasItems) return i18nService.t('nanoLibraryStatusDegraded');
  if (status.status === NanoBananaSourceStatus.Error) return i18nService.t('nanoLibraryStatusError');
  if (status.status === NanoBananaSourceStatus.Stale) return i18nService.t('nanoLibraryStatusStale');
  return i18nService.t('nanoLibraryStatusReady');
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const NanoLibraryView: React.FC = () => {
  const [filters, setFilters] = useState<NanoBananaSearchInput>(defaultFilters);
  const [status, setStatus] = useState<NanoBananaSourceStatusSnapshot | null>(null);
  const [items, setItems] = useState<NanoBananaPromptIndexItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [selectedIndexItem, setSelectedIndexItem] = useState<NanoBananaPromptIndexItem | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<NanoBananaPrompt | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const hasItems = items.length > 0;
  const statusLabel = useMemo(() => getStatusLabel(status, hasItems), [status, hasItems]);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await nanoBananaService.getSourceStatus(NanoBananaDefaultSourceId));
    } catch (nextError) {
      setSyncWarning(nextError instanceof Error ? nextError.message : i18nService.t('nanoLibraryStatusLoadFailed'));
    }
  }, []);

  const search = useCallback(async (input: NanoBananaSearchInput, append = false) => {
    setIsLoading(true);
    try {
      const result = await nanoBananaService.search({
        ...input,
        sourceId: NanoBananaDefaultSourceId,
        limit: PageSize,
      });
      setItems((current) => append ? [...current, ...result.items] : result.items);
      setTotalItems(result.totalItems);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : i18nService.t('nanoLibrarySearchFailed'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void search({ ...filters, offset: 0 }, false);
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [filters, search]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setSyncWarning(null);
    try {
      const result = await nanoBananaService.sync({
        sourceId: NanoBananaDefaultSourceId,
        force: true,
        mode: 'force',
      });
      if (result.status === NanoBananaSyncStatus.Failed || result.status === NanoBananaSyncStatus.PartialFailed || result.warnings.length > 0) {
        setSyncWarning(result.error || result.warnings[0] || i18nService.t('nanoLibrarySyncPartial'));
      }
      await loadStatus();
      await search({ ...filters, offset: 0 }, false);
    } catch (nextError) {
      setSyncWarning(nextError instanceof Error ? nextError.message : i18nService.t('nanoLibrarySyncFailed'));
      await loadStatus();
      await search({ ...filters, offset: 0 }, false);
    } finally {
      setIsRefreshing(false);
    }
  }, [filters, loadStatus, search]);

  const loadMore = useCallback(() => {
    const nextFilters = {
      ...filters,
      offset: items.length,
    };
    void search(nextFilters, true);
  }, [filters, items.length, search]);

  const openDetail = useCallback(async (item: NanoBananaPromptIndexItem) => {
    setSelectedIndexItem(item);
    setSelectedPrompt(null);
    setDetailError(null);
    setIsDetailLoading(true);
    try {
      const result = await nanoBananaService.getPrompt({
        sourceId: item.sourceId,
        sourcePromptId: item.sourcePromptId,
      });
      setSelectedPrompt(result.prompt);
      if (!result.prompt) {
        setDetailError(i18nService.t('nanoLibraryDetailNotFound'));
        return;
      }
      void nanoBananaService.recordUsage({
        sourceId: result.prompt.sourceId,
        promptId: result.prompt.id,
        sourcePromptId: result.prompt.sourcePromptId,
        eventType: NanoBananaUsageEventType.View,
      }).catch(() => undefined);
    } catch (nextError) {
      setDetailError(nextError instanceof Error ? nextError.message : i18nService.t('nanoLibraryDetailLoadFailed'));
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const copyPrompt = useCallback((text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      dispatchToast(i18nService.t('copied'));
      if (selectedPrompt) {
        void nanoBananaService.recordUsage({
          sourceId: selectedPrompt.sourceId,
          promptId: selectedPrompt.id,
          sourcePromptId: selectedPrompt.sourcePromptId,
          eventType: NanoBananaUsageEventType.Copy,
        }).catch(() => undefined);
      }
    }).catch((nextError) => {
      dispatchToast(nextError instanceof Error ? nextError.message : i18nService.t('nanoLibraryCopyFailed'));
    });
  }, [selectedPrompt]);

  const openSource = useCallback((url: string) => {
    if (!isHttpUrl(url)) {
      dispatchToast(i18nService.t('nanoLibraryInvalidSourceUrl'));
      return;
    }
    void window.electron.shell.openExternal(url).then((result) => {
      if (!result.success) {
        dispatchToast(result.error || i18nService.t('nanoLibraryOpenSourceFailed'));
      }
    });
  }, []);

  const showInitialEmpty = !isLoading && !error && !hasItems && totalItems === 0;
  const showLoadMore = items.length < totalItems;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{i18nService.t('nanoLibraryTitle')}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span>{statusLabel}</span>
              <span>{i18nService.t('nanoLibraryRemoteVersion').replace('{version}', status?.source.raw && typeof status.source.raw === 'object' && 'version' in status.source.raw ? String(status.source.raw.version) : status?.source.lastUpdatedRemote || '-')}</span>
              <span>{i18nService.t('nanoLibraryLastSynced').replace('{time}', formatTime(status?.source.lastSyncedAt))}</span>
              <span>{i18nService.t('nanoLibraryCacheStats')
                .replace('{index}', String(status?.indexItemCount ?? 0))
                .replace('{prompts}', String(status?.cachedPromptCount ?? 0))}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-secondary">
            <ServerStackIcon className="h-4 w-4 text-muted" />
            {i18nService.t('nanoLibrarySourceName')}
          </div>
        </div>
        {(syncWarning || error || status?.lastError) && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{syncWarning || error || status?.lastError}</span>
          </div>
        )}
      </div>

      <NanoPromptFilters
        filters={filters}
        isRefreshing={isRefreshing}
        onFiltersChange={(nextFilters) => {
          setFilters({ ...nextFilters, offset: 0 });
        }}
        onRefresh={refresh}
      />

      <div className="flex-1 px-4 py-4">
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span>{i18nService.t('nanoLibraryResultCount').replace('{count}', String(totalItems))}</span>
          {isLoading && <span>{i18nService.t('nanoLibraryLoading')}</span>}
        </div>

        {error && !hasItems ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface text-center">
            <ExclamationTriangleIcon className="h-10 w-10 text-amber-500" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">{i18nService.t('nanoLibrarySearchFailedTitle')}</h3>
            <p className="mt-1 max-w-md text-sm text-secondary">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              {i18nService.t('nanoLibraryRefresh')}
            </button>
          </div>
        ) : showInitialEmpty ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface text-center">
            <ServerStackIcon className="h-10 w-10 text-muted" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">{i18nService.t('nanoLibraryEmptyTitle')}</h3>
            <p className="mt-1 max-w-md text-sm text-secondary">{i18nService.t('nanoLibraryEmptyHint')}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              {i18nService.t('nanoLibraryRefresh')}
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((item) => (
                <NanoPromptCard
                  key={item.id}
                  item={item}
                  selected={selectedIndexItem?.id === item.id}
                  onSelect={(nextItem) => void openDetail(nextItem)}
                />
              ))}
            </div>
            {showLoadMore && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoading}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {i18nService.t('creatorLoadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedIndexItem && (
        <NanoPromptDetailDrawer
          prompt={selectedPrompt}
          indexItem={selectedIndexItem}
          isLoading={isDetailLoading}
          error={detailError}
          onClose={() => {
            setSelectedIndexItem(null);
            setSelectedPrompt(null);
            setDetailError(null);
          }}
          onCopyPrompt={copyPrompt}
          onOpenSource={openSource}
        />
      )}
    </div>
  );
};
