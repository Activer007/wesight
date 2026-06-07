import { PhotoIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { NanoBananaPromptIndexItem } from '@shared/nanoBanana/types';
import React, { useState } from 'react';

import { i18nService } from '../../../services/i18n';

interface NanoPromptCardProps {
  item: NanoBananaPromptIndexItem;
  selected: boolean;
  onSelect: (item: NanoBananaPromptIndexItem) => void;
}

export const NanoPromptCard: React.FC<NanoPromptCardProps> = ({ item, selected, onSelect }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const categories = item.categories.slice(0, 3);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border bg-surface text-left transition-colors hover:border-primary/60 hover:bg-surface-raised ${
        selected ? 'border-primary shadow-sm' : 'border-border'
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-raised">
        {item.thumbnailUrl && !imageFailed ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <PhotoIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
          {i18nService.t('nanoLibraryPageLabel').replace('{page}', String(item.page))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="min-h-0">
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</h3>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-secondary">{item.description}</p>
        </div>
        <div className="mt-auto space-y-3">
          <div className="truncate text-xs text-muted">
            {item.authorName || i18nService.t('creatorUnknownSource')}
          </div>
          {(categories.length > 0 || item.needReferenceImages) && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <span key={category} className="rounded-md bg-surface-raised px-2 py-1 text-[11px] text-secondary">
                  {category}
                </span>
              ))}
              {item.needReferenceImages && (
                <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                  {i18nService.t('nanoLibraryNeedReferenceShort')}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{i18nService.t('nanoLibraryLikes').replace('{count}', String(item.likes))}</span>
            <span className="inline-flex items-center gap-1">
              <SparklesIcon className="h-3.5 w-3.5" />
              {i18nService.t('nanoLibraryResults').replace('{count}', String(item.resultsCount))}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};
