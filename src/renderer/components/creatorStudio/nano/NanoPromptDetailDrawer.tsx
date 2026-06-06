import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { NanoBananaPrompt, NanoBananaPromptIndexItem } from '@shared/nanoBanana/types';
import React, { useMemo, useState } from 'react';

import { i18nService } from '../../../services/i18n';

interface NanoPromptDetailDrawerProps {
  prompt: NanoBananaPrompt | null;
  indexItem: NanoBananaPromptIndexItem | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onCopyPrompt: (text: string) => void;
  onOpenSource: (url: string) => void;
}

const isHttpUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const ImagePreview: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-surface-raised text-muted">
        <PhotoIcon className="h-8 w-8" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded-lg border border-border object-cover"
    />
  );
};

export const NanoPromptDetailDrawer: React.FC<NanoPromptDetailDrawerProps> = ({
  prompt,
  indexItem,
  isLoading,
  error,
  onClose,
  onCopyPrompt,
  onOpenSource,
}) => {
  const title = prompt?.title ?? indexItem?.title ?? i18nService.t('nanoLibraryDetail');
  const sourceUrl = prompt?.sourceLink ?? null;
  const canOpenSource = isHttpUrl(sourceUrl);
  const tags = useMemo(() => [
    ...(prompt?.promptCategories ?? []),
    ...(prompt?.tags ?? []),
    ...(prompt?.tagsZh ?? []),
  ].filter(Boolean).slice(0, 18), [prompt]);
  const media = prompt?.media?.length ? prompt.media : prompt?.mediaThumbnails ?? [];

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
      <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            {i18nService.t('nanoLibraryDetail')}
          </div>
          <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-surface-raised hover:text-foreground"
          aria-label={i18nService.t('close')}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {isLoading && (
          <div className="rounded-lg border border-border bg-surface p-4 text-sm text-secondary">
            {i18nService.t('nanoLibraryDetailLoading')}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </div>
        )}
        {!isLoading && !error && prompt && (
          <div className="space-y-5">
            {media.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {media.slice(0, 4).map((url) => (
                  <ImagePreview key={url} url={url} title={prompt.title} />
                ))}
              </div>
            )}

            <section className="space-y-2">
              <p className="text-sm leading-6 text-secondary">{prompt.description}</p>
              <div className="grid gap-2 text-xs text-muted sm:grid-cols-2">
                <div>{i18nService.t('nanoLibraryAuthor')}: {prompt.author?.name || indexItem?.authorName || i18nService.t('creatorUnknownSource')}</div>
                <div>{i18nService.t('nanoLibrarySource')}: {prompt.sourcePlatform || i18nService.t('creatorUnknownSource')}</div>
                <div>{i18nService.t('nanoLibraryLikes').replace('{count}', String(prompt.likes))}</div>
                <div>{i18nService.t('nanoLibraryResults').replace('{count}', String(prompt.resultsCount))}</div>
              </div>
              {prompt.needReferenceImages && (
                <div className="inline-flex rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-300">
                  {i18nService.t('nanoLibraryNeedReference')}
                </div>
              )}
            </section>

            {tags.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{i18nService.t('nanoLibraryTags')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-surface-raised px-2 py-1 text-xs text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{i18nService.t('nanoLibraryPromptContent')}</h3>
                <button
                  type="button"
                  onClick={() => onCopyPrompt(prompt.content)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-raised"
                >
                  <ClipboardDocumentIcon className="h-4 w-4" />
                  {i18nService.t('creatorCopyPrompt')}
                </button>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-xs leading-5 text-secondary">
                {prompt.content}
              </pre>
            </section>

            {prompt.translatedContent && (
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{i18nService.t('nanoLibraryTranslatedContent')}</h3>
                  <button
                    type="button"
                    onClick={() => onCopyPrompt(prompt.translatedContent || '')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-raised"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    {i18nService.t('nanoLibraryCopyTranslation')}
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-xs leading-5 text-secondary">
                  {prompt.translatedContent}
                </pre>
              </section>
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3">
        <div className="min-w-0 truncate text-xs text-muted">
          {prompt?.sourcePublishedAt || indexItem?.publishedAt || ''}
        </div>
        <button
          type="button"
          onClick={() => {
            if (canOpenSource && sourceUrl) onOpenSource(sourceUrl);
          }}
          disabled={!canOpenSource}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          {i18nService.t('nanoLibraryOpenSource')}
        </button>
      </footer>
    </aside>
  );
};
