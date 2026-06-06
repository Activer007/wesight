import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingPresetId,
  CreatorProductionAssetStatus,
} from '@shared/creatorStudio/constants';
import type {
  CreatorImageProcessingJob,
  CreatorImageProcessingPlan,
  CreatorImageProcessingTask,
} from '@shared/creatorStudio/imageProcessingTypes';
import type { CreatorProductionAssetRecord } from '@shared/creatorStudio/types';
import React, { useEffect, useState } from 'react';

import { creatorStudioAssetService } from '../../services/creatorStudioAssets';
import { i18nService } from '../../services/i18n';
import { ImageProcessingPlanCard } from './ImageProcessingPlanCard';
import { ImageProcessingResultSummary } from './ImageProcessingResultSummary';

const presetOptions = [
  CreatorImageProcessingPresetId.WebOptimizedWebp,
  CreatorImageProcessingPresetId.ReadmeBanner,
  CreatorImageProcessingPresetId.SocialCard1200x675,
] as const;

const outputFormatOptions = [
  CreatorImageProcessingOutputFormat.Webp,
  CreatorImageProcessingOutputFormat.Jpeg,
  CreatorImageProcessingOutputFormat.Png,
  CreatorImageProcessingOutputFormat.Avif,
] as const;

const rotateOptions = [0, 90, 180, 270] as const;

const getPresetLabel = (presetId: CreatorImageProcessingPresetId): string => {
  switch (presetId) {
    case CreatorImageProcessingPresetId.ReadmeBanner:
      return i18nService.t('creatorImageProcessingPresetReadmeBanner');
    case CreatorImageProcessingPresetId.SocialCard1200x675:
      return i18nService.t('creatorImageProcessingPresetSocialCard');
    case CreatorImageProcessingPresetId.WebOptimizedWebp:
    default:
      return i18nService.t('creatorImageProcessingPresetWebOptimized');
  }
};

export const ImagePostProcessingDrawer: React.FC<{
  asset: CreatorProductionAssetRecord | null;
  onClose: () => void;
  onCompleted: (assets: CreatorProductionAssetRecord[]) => void;
}> = ({ asset, onClose, onCompleted }) => {
  const [presetId, setPresetId] = useState<CreatorImageProcessingPresetId>(CreatorImageProcessingPresetId.WebOptimizedWebp);
  const [outputFormat, setOutputFormat] = useState<CreatorImageProcessingOutputFormat>(CreatorImageProcessingOutputFormat.Webp);
  const [quality, setQuality] = useState(80);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [maxWidth, setMaxWidth] = useState('1600');
  const [maxHeight, setMaxHeight] = useState('1600');
  const [cropRatio, setCropRatio] = useState('');
  const [rotate, setRotate] = useState(0);
  const [plan, setPlan] = useState<CreatorImageProcessingPlan | null>(null);
  const [job, setJob] = useState<CreatorImageProcessingJob | null>(null);
  const [tasks, setTasks] = useState<CreatorImageProcessingTask[]>([]);
  const [outputAssets, setOutputAssets] = useState<CreatorProductionAssetRecord[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(null);
    setJob(null);
    setTasks([]);
    setOutputAssets([]);
    setError(null);
  }, [asset?.id]);

  useEffect(() => {
    if (!asset || asset.imageMetadata || asset.status !== CreatorProductionAssetStatus.Ready) return;
    let cancelled = false;
    setIsInspecting(true);
    void creatorStudioAssetService.inspectImage({ assetId: asset.id })
      .catch((inspectError) => {
        if (!cancelled) {
          setError(inspectError instanceof Error ? inspectError.message : i18nService.t('creatorImageMetadataInspectFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsInspecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  if (!asset) return null;

  const disabled = isPlanning || isExecuting;
  const parseOptionalNumber = (value: string): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const handleCreatePlan = async () => {
    setError(null);
    setIsPlanning(true);
    try {
      const createdPlan = await creatorStudioAssetService.createImagePlan({
        assetId: asset.id,
        presetId,
        outputFormat,
        quality,
        width: parseOptionalNumber(width),
        height: parseOptionalNumber(height),
        maxWidth: parseOptionalNumber(maxWidth),
        maxHeight: parseOptionalNumber(maxHeight),
        cropRatio: cropRatio.trim() || null,
        rotate,
      });
      setPlan(createdPlan);
      setJob(null);
      setTasks([]);
      setOutputAssets([]);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : i18nService.t('creatorImageProcessingPlanFailed'));
    } finally {
      setIsPlanning(false);
    }
  };

  const handleExecute = async () => {
    if (!plan) return;
    setError(null);
    setIsExecuting(true);
    try {
      const result = await creatorStudioAssetService.executeImageJob({ planId: plan.id });
      setJob(result.job);
      setTasks(result.tasks);
      setOutputAssets(result.outputAssets);
      onCompleted(result.outputAssets);
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : i18nService.t('creatorImageProcessingExecuteFailed'));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReveal = () => {
    if (!job) return;
    void creatorStudioAssetService.revealImageOutput({ jobId: job.id }).catch((revealError) => {
      setError(revealError instanceof Error ? revealError.message : i18nService.t('creatorImageProcessingRevealFailed'));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <aside className="flex h-full w-full max-w-xl flex-col bg-background shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{i18nService.t('creatorImagePostProcessing')}</h2>
            <p className="mt-1 truncate text-xs text-muted">{asset.fileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label={i18nService.t('close')}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
          {isInspecting && (
            <div className="rounded-lg border border-border bg-surface p-3 text-sm text-secondary">
              {i18nService.t('creatorImageMetadataLoading')}
            </div>
          )}

          <section className="rounded-lg border border-border bg-surface p-3">
            <h3 className="text-sm font-semibold">{i18nService.t('creatorImageProcessingSettings')}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingPreset')}</span>
                <select
                  value={presetId}
                  disabled={disabled}
                  onChange={(event) => setPresetId(event.target.value as CreatorImageProcessingPresetId)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                >
                  {presetOptions.map((option) => (
                    <option key={option} value={option}>{getPresetLabel(option)}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingOutputFormat')}</span>
                <select
                  value={outputFormat}
                  disabled={disabled}
                  onChange={(event) => setOutputFormat(event.target.value as CreatorImageProcessingOutputFormat)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                >
                  {outputFormatOptions.map((option) => (
                    <option key={option} value={option}>{option.toUpperCase()}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingQuality')}</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={quality}
                  disabled={disabled}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingRotate')}</span>
                <select
                  value={rotate}
                  disabled={disabled}
                  onChange={(event) => setRotate(Number(event.target.value))}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                >
                  {rotateOptions.map((option) => (
                    <option key={option} value={option}>{option} deg</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingWidth')}</span>
                <input value={width} disabled={disabled} onChange={(event) => setWidth(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingHeight')}</span>
                <input value={height} disabled={disabled} onChange={(event) => setHeight(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingMaxWidth')}</span>
                <input value={maxWidth} disabled={disabled} onChange={(event) => setMaxWidth(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingMaxHeight')}</span>
                <input value={maxHeight} disabled={disabled} onChange={(event) => setMaxHeight(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary" />
              </label>
              <label className="col-span-2 space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingCropRatio')}</span>
                <input
                  value={cropRatio}
                  disabled={disabled}
                  placeholder="16:9"
                  onChange={(event) => setCropRatio(event.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={disabled || asset.status !== CreatorProductionAssetStatus.Ready}
              onClick={() => void handleCreatePlan()}
              className="mt-3 h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlanning ? i18nService.t('creatorImageProcessingPlanning') : i18nService.t('creatorImageProcessingCreatePlan')}
            </button>
          </section>

          {plan && <ImageProcessingPlanCard plan={plan} />}
          {job && (
            <ImageProcessingResultSummary
              job={job}
              tasks={tasks}
              outputAssets={outputAssets}
              onRevealOutput={handleReveal}
            />
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            {i18nService.t('cancel')}
          </button>
          <button
            type="button"
            disabled={!plan || isExecuting}
            onClick={() => void handleExecute()}
            className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExecuting ? i18nService.t('creatorImageProcessingExecuting') : i18nService.t('creatorImageProcessingConfirmExecute')}
          </button>
        </footer>
      </aside>
    </div>
  );
};
