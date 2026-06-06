import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  FolderArrowDownIcon,
  FolderOpenIcon,
  ScissorsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  CreatorImageProcessingOutputFormat,
  CreatorImageQuickEditSaveMode,
  CreatorProductionAssetSource,
} from '@shared/creatorStudio/constants';
import type { CreatorImageQuickEditSaveResult } from '@shared/creatorStudio/imageProcessingTypes';
import type { CreatorProductionAssetRecord } from '@shared/creatorStudio/types';
import React, { useMemo, useState } from 'react';

import { creatorStudioAssetService } from '../../services/creatorStudioAssets';
import { i18nService } from '../../services/i18n';
import { ImagePostProcessingDrawer } from './ImagePostProcessingDrawer';

const OriginalOutputFormat = 'original' as const;

type QuickEditOutputFormat = typeof OriginalOutputFormat | CreatorImageProcessingOutputFormat;

const outputFormatOptions = [
  OriginalOutputFormat,
  CreatorImageProcessingOutputFormat.Webp,
  CreatorImageProcessingOutputFormat.Jpeg,
  CreatorImageProcessingOutputFormat.Png,
  CreatorImageProcessingOutputFormat.Avif,
] as const;

const cropRatioOptions = [
  '',
  '1:1',
  '16:9',
  '4:3',
  '3:2',
  '2:3',
  'custom',
] as const;

const encodeLocalFileSrc = (filePath: string): string => {
  const raw = filePath.trim();
  const normalized = raw.replace(/\\/g, '/');
  const fileUrl = /^file:\/\//i.test(normalized)
    ? normalized
    : normalized.startsWith('/')
      ? `file://${normalized}`
      : `file:///${normalized}`;
  return encodeURI(fileUrl)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/^file:\/\//i, 'localfile://');
};

const isVirtualPath = (filePath: string | null | undefined): boolean => (
  !filePath || filePath.startsWith('creator://')
);

export const canOverwriteQuickEditAsset = (asset: CreatorProductionAssetRecord | null): boolean => (
  Boolean(asset)
  && (
    asset?.source === CreatorProductionAssetSource.LocalImageImport
    || asset?.source === CreatorProductionAssetSource.LocalImageProcessing
  )
  && !isVirtualPath(asset?.filePath)
);

const getPreviewSrc = (asset: CreatorProductionAssetRecord): string | null => {
  if (!isVirtualPath(asset.filePath)) {
    return encodeLocalFileSrc(asset.filePath);
  }
  if (asset.imageSource?.localPath && !isVirtualPath(asset.imageSource.localPath)) {
    return encodeLocalFileSrc(asset.imageSource.localPath);
  }
  return asset.imageSource?.thumbnailUrl ?? asset.imageSource?.originalUrl ?? null;
};

const getRatioValue = (ratio: string): number | undefined => {
  const match = ratio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : undefined;
};

const formatLabel = (format: QuickEditOutputFormat): string => {
  if (format === OriginalOutputFormat) return i18nService.t('creatorImageQuickEditFormatOriginal');
  return format.toUpperCase();
};

export const ImageQuickEditDrawer: React.FC<{
  asset: CreatorProductionAssetRecord | null;
  onClose: () => void;
  onCompleted: (assets: CreatorProductionAssetRecord[]) => void;
}> = ({ asset, onClose, onCompleted }) => {
  const [rotate, setRotate] = useState(0);
  const [cropRatio, setCropRatio] = useState<typeof cropRatioOptions[number]>('');
  const [customCropRatio, setCustomCropRatio] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [longestEdge, setLongestEdge] = useState('');
  const [keepAspect, setKeepAspect] = useState(true);
  const [outputFormat, setOutputFormat] = useState<QuickEditOutputFormat>(OriginalOutputFormat);
  const [quality, setQuality] = useState(82);
  const [savingMode, setSavingMode] = useState<CreatorImageQuickEditSaveMode | null>(null);
  const [result, setResult] = useState<CreatorImageQuickEditSaveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const previewSrc = asset ? getPreviewSrc(asset) : null;
  const activeCropRatio = cropRatio === 'custom' ? customCropRatio.trim() : cropRatio;
  const activeCropAspect = activeCropRatio ? getRatioValue(activeCropRatio) : undefined;
  const canOverwrite = canOverwriteQuickEditAsset(asset);
  const showQuality = outputFormat === CreatorImageProcessingOutputFormat.Webp
    || outputFormat === CreatorImageProcessingOutputFormat.Jpeg
    || outputFormat === CreatorImageProcessingOutputFormat.Avif;
  const isSaving = Boolean(savingMode);

  const parseOptionalNumber = (value: string): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const saveInput = useMemo(() => {
    if (!asset) return null;
    return {
      assetId: asset.id,
      rotate,
      cropRatio: activeCropRatio || null,
      width: parseOptionalNumber(width),
      height: parseOptionalNumber(height),
      longestEdge: parseOptionalNumber(longestEdge),
      keepAspect,
      outputFormat: outputFormat === OriginalOutputFormat ? null : outputFormat,
      quality: showQuality ? quality : null,
    };
  }, [activeCropRatio, asset, height, keepAspect, longestEdge, outputFormat, quality, rotate, showQuality, width]);

  if (!asset) return null;

  const resetEdits = () => {
    setRotate(0);
    setCropRatio('');
    setCustomCropRatio('');
    setWidth('');
    setHeight('');
    setLongestEdge('');
    setKeepAspect(true);
    setOutputFormat(OriginalOutputFormat);
    setQuality(82);
    setResult(null);
    setError(null);
  };

  const handleSave = async (saveMode: CreatorImageQuickEditSaveMode) => {
    if (!saveInput) return;
    setError(null);
    setSavingMode(saveMode);
    try {
      const saved = await creatorStudioAssetService.saveImageQuickEdit({
        ...saveInput,
        saveMode,
      });
      if (!saved) return;
      setResult(saved);
      if (saved.asset) {
        onCompleted([saved.asset]);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : i18nService.t('creatorImageQuickEditSaveFailed'));
    } finally {
      setSavingMode(null);
    }
  };

  const handleReveal = () => {
    if (!result?.outputPath) return;
    void creatorStudioAssetService.revealImageQuickEdit({ outputPath: result.outputPath }).catch((revealError) => {
      setError(revealError instanceof Error ? revealError.message : i18nService.t('creatorImageQuickEditRevealFailed'));
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-3xl flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{i18nService.t('creatorImageQuickEditTitle')}</h2>
            <p className="mt-1 max-w-xl truncate text-xs text-muted">{asset.fileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label={i18nService.t('close')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-0 items-center justify-center bg-surface-raised p-6">
            <div
              className="flex max-h-full max-w-full items-center justify-center overflow-hidden bg-black/80"
              style={{
                aspectRatio: activeCropAspect,
                width: activeCropAspect ? 'min(100%, 720px)' : undefined,
                maxHeight: '100%',
              }}
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={asset.fileName}
                  className="max-h-full max-w-full object-cover transition-transform"
                  style={{
                    transform: `rotate(${rotate}deg)`,
                    aspectRatio: activeCropAspect,
                    width: activeCropAspect ? '100%' : undefined,
                    height: activeCropAspect ? '100%' : undefined,
                  }}
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-sm text-muted">
                  {i18nService.t('creatorImageSourceUnavailable')}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto border-l border-border p-4">
            <div className="space-y-5">
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted">{i18nService.t('creatorImageQuickEditRotate')}</div>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" className="rounded-lg border border-border p-2 hover:bg-surface-raised" onClick={() => setRotate((value) => (value + 270) % 360)} title={i18nService.t('creatorImageQuickEditRotateLeft')}>
                    <ArrowUturnLeftIcon className="mx-auto h-4 w-4" />
                  </button>
                  <button type="button" className="rounded-lg border border-border p-2 hover:bg-surface-raised" onClick={() => setRotate((value) => (value + 90) % 360)} title={i18nService.t('creatorImageQuickEditRotateRight')}>
                    <ArrowUturnRightIcon className="mx-auto h-4 w-4" />
                  </button>
                  <button type="button" className="rounded-lg border border-border p-2 text-xs hover:bg-surface-raised" onClick={() => setRotate((value) => (value + 180) % 360)}>
                    180
                  </button>
                  <button type="button" className="rounded-lg border border-border p-2 hover:bg-surface-raised" onClick={resetEdits} title={i18nService.t('creatorImageQuickEditReset')}>
                    <ArrowPathIcon className="mx-auto h-4 w-4" />
                  </button>
                </div>
              </section>

              <section className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted" htmlFor="quick-edit-crop-ratio">
                  {i18nService.t('creatorImageQuickEditCropRatio')}
                </label>
                <select
                  id="quick-edit-crop-ratio"
                  value={cropRatio}
                  onChange={(event) => setCropRatio(event.target.value as typeof cropRatioOptions[number])}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                >
                  {cropRatioOptions.map((ratio) => (
                    <option key={ratio || 'original'} value={ratio}>
                      {ratio === ''
                        ? i18nService.t('creatorImageQuickEditCropOriginal')
                        : ratio === 'custom'
                          ? i18nService.t('creatorImageQuickEditCropCustom')
                          : ratio}
                    </option>
                  ))}
                </select>
                {cropRatio === 'custom' && (
                  <input
                    value={customCropRatio}
                    onChange={(event) => setCustomCropRatio(event.target.value)}
                    placeholder="21:9"
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                  />
                )}
              </section>

              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted">{i18nService.t('creatorImageQuickEditSize')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={width} onChange={(event) => setWidth(event.target.value)} inputMode="numeric" placeholder={i18nService.t('creatorImageQuickEditWidth')} className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary" />
                  <input value={height} onChange={(event) => setHeight(event.target.value)} inputMode="numeric" placeholder={i18nService.t('creatorImageQuickEditHeight')} className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary" />
                </div>
                <input value={longestEdge} onChange={(event) => setLongestEdge(event.target.value)} inputMode="numeric" placeholder={i18nService.t('creatorImageQuickEditLongestEdge')} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary" />
                <label className="flex items-center gap-2 text-sm text-secondary">
                  <input type="checkbox" checked={keepAspect} onChange={(event) => setKeepAspect(event.target.checked)} />
                  {i18nService.t('creatorImageQuickEditKeepAspect')}
                </label>
              </section>

              <section className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted" htmlFor="quick-edit-output-format">
                  {i18nService.t('creatorImageQuickEditFormat')}
                </label>
                <select
                  id="quick-edit-output-format"
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value as QuickEditOutputFormat)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                >
                  {outputFormatOptions.map((format) => (
                    <option key={format} value={format}>{formatLabel(format)}</option>
                  ))}
                </select>
                {showQuality && (
                  <label className="block text-sm text-secondary">
                    <span className="mb-1 flex justify-between">
                      <span>{i18nService.t('creatorImageQuickEditQuality')}</span>
                      <span>{quality}</span>
                    </span>
                    <input type="range" min={1} max={100} value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="w-full" />
                  </label>
                )}
              </section>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  {error}
                </div>
              )}

              {result?.outputPath && (
                <div className="space-y-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-secondary">
                  <div className="font-medium text-foreground">{i18nService.t('creatorImageQuickEditSaved')}</div>
                  <div className="truncate">{result.outputPath}</div>
                  <button type="button" onClick={handleReveal} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <FolderOpenIcon className="h-4 w-4" />
                    {i18nService.t('creatorImageQuickEditOpenOutput')}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!canOverwrite || isSaving}
                  onClick={() => void handleSave(CreatorImageQuickEditSaveMode.Overwrite)}
                  title={!canOverwrite ? i18nService.t('creatorImageQuickEditOverwriteUnavailable') : undefined}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  {savingMode === CreatorImageQuickEditSaveMode.Overwrite ? i18nService.t('creatorImageQuickEditSaving') : i18nService.t('creatorImageQuickEditSave')}
                </button>
                <button type="button" disabled={isSaving} onClick={() => void handleSave(CreatorImageQuickEditSaveMode.Copy)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">
                  <ScissorsIcon className="h-4 w-4" />
                  {savingMode === CreatorImageQuickEditSaveMode.Copy ? i18nService.t('creatorImageQuickEditSaving') : i18nService.t('creatorImageQuickEditSaveCopy')}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={isSaving} onClick={() => void handleSave(CreatorImageQuickEditSaveMode.SaveAs)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    {i18nService.t('creatorImageQuickEditSaveAs')}
                  </button>
                  <button type="button" disabled={isSaving} onClick={() => void handleSave(CreatorImageQuickEditSaveMode.Export)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                    <FolderArrowDownIcon className="h-4 w-4" />
                    {i18nService.t('creatorImageQuickEditExport')}
                  </button>
                </div>
                <button type="button" onClick={() => setIsAdvancedOpen(true)} className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground">
                  {i18nService.t('creatorImageQuickEditAdvanced')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
      {isAdvancedOpen && (
        <ImagePostProcessingDrawer
          asset={asset}
          onClose={() => setIsAdvancedOpen(false)}
          onCompleted={onCompleted}
        />
      )}
    </>
  );
};
