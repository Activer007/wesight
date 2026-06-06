import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { NanoBananaSearchSort } from '@shared/nanoBanana/constants';
import type { NanoBananaSearchInput } from '@shared/nanoBanana/types';
import React from 'react';

import { i18nService } from '../../../services/i18n';

interface NanoPromptFiltersProps {
  filters: NanoBananaSearchInput;
  isRefreshing: boolean;
  onFiltersChange: (filters: NanoBananaSearchInput) => void;
  onRefresh: () => void;
}

const parseCsv = (value: string): string[] => (
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

export const NanoPromptFilters: React.FC<NanoPromptFiltersProps> = ({
  filters,
  isRefreshing,
  onFiltersChange,
  onRefresh,
}) => {
  const categoryText = (filters.categories ?? []).join(', ');
  const tagText = (filters.tags ?? []).join(', ');

  return (
    <div className="border-b border-border bg-surface px-4 py-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_160px_160px_170px_140px_auto]">
        <label className="relative block">
          <span className="sr-only">{i18nService.t('nanoLibrarySearch')}</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={filters.query ?? ''}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value, offset: 0 })}
            placeholder={i18nService.t('nanoLibrarySearchPlaceholder')}
            className="h-10 w-full rounded-lg border border-border bg-surface-raised pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary"
          />
        </label>
        <input
          type="text"
          value={categoryText}
          onChange={(event) => onFiltersChange({ ...filters, categories: parseCsv(event.target.value), offset: 0 })}
          placeholder={i18nService.t('nanoLibraryCategoryPlaceholder')}
          className="h-10 rounded-lg border border-border bg-surface-raised px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
        />
        <input
          type="text"
          value={tagText}
          onChange={(event) => onFiltersChange({ ...filters, tags: parseCsv(event.target.value), offset: 0 })}
          placeholder={i18nService.t('nanoLibraryTagPlaceholder')}
          className="h-10 rounded-lg border border-border bg-surface-raised px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
        />
        <select
          value={filters.sort ?? NanoBananaSearchSort.PublishedDesc}
          onChange={(event) => onFiltersChange({ ...filters, sort: event.target.value as NanoBananaSearchSort, offset: 0 })}
          className="h-10 rounded-lg border border-border bg-surface-raised px-3 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value={NanoBananaSearchSort.Relevance}>{i18nService.t('nanoLibrarySortRelevance')}</option>
          <option value={NanoBananaSearchSort.PublishedDesc}>{i18nService.t('nanoLibrarySortNewest')}</option>
          <option value={NanoBananaSearchSort.LikesDesc}>{i18nService.t('nanoLibrarySortLikes')}</option>
          <option value={NanoBananaSearchSort.ResultsDesc}>{i18nService.t('nanoLibrarySortResults')}</option>
          <option value={NanoBananaSearchSort.MostUsed}>{i18nService.t('nanoLibrarySortMostUsed')}</option>
          <option value={NanoBananaSearchSort.RecentlyUsed}>{i18nService.t('nanoLibrarySortRecentlyUsed')}</option>
          <option value={NanoBananaSearchSort.AdoptedBoost}>{i18nService.t('nanoLibrarySortAdoptedBoost')}</option>
        </select>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-sm text-secondary">
          <input
            type="checkbox"
            checked={Boolean(filters.needReferenceImages)}
            onChange={(event) => onFiltersChange({ ...filters, needReferenceImages: event.target.checked, offset: 0 })}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="truncate">{i18nService.t('nanoLibraryNeedReferenceShort')}</span>
        </label>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? i18nService.t('nanoLibraryRefreshing') : i18nService.t('nanoLibraryRefresh')}
        </button>
      </div>
    </div>
  );
};
