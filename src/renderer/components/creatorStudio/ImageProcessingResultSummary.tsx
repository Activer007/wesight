import type {
  CreatorImageProcessingJob,
  CreatorImageProcessingTask,
} from '@shared/creatorStudio/imageProcessingTypes';
import type { CreatorProductionAssetRecord } from '@shared/creatorStudio/types';
import React from 'react';

import { i18nService } from '../../services/i18n';

const formatFileSize = (bytes: number | null | undefined): string => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return i18nService.t('creatorImageUnknown');
  }
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

export const ImageProcessingResultSummary: React.FC<{
  job: CreatorImageProcessingJob;
  tasks: CreatorImageProcessingTask[];
  outputAssets: CreatorProductionAssetRecord[];
  onRevealOutput: () => void;
}> = ({ job, tasks, outputAssets, onRevealOutput }) => {
  const firstTask = tasks[0] ?? null;
  const savedPercent = job.inputTotalSize > 0
    ? Math.round((job.savedSize / job.inputTotalSize) * 100)
    : null;

  return (
    <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
      <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        {i18nService.t('creatorImageProcessingCompleted')}
      </h3>
      <div className="mt-2 space-y-1 text-xs text-secondary">
        <div className="flex justify-between gap-3">
          <span>{i18nService.t('creatorImageProcessingInputSize')}</span>
          <span>{formatFileSize(job.inputTotalSize)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{i18nService.t('creatorImageProcessingOutputSize')}</span>
          <span>{formatFileSize(job.outputTotalSize)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{i18nService.t('creatorImageProcessingSavedSize')}</span>
          <span>{formatFileSize(job.savedSize)}{savedPercent !== null ? ` (${savedPercent}%)` : ''}</span>
        </div>
        {outputAssets[0] && (
          <div className="truncate text-muted">
            {i18nService.t('creatorImageProcessingDerivedAsset')}: {outputAssets[0].fileName}
          </div>
        )}
        {firstTask?.errorMessage && (
          <div className="text-red-600 dark:text-red-300">{firstTask.errorMessage}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onRevealOutput}
        className="mt-3 h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {i18nService.t('creatorImageProcessingOpenOutputDirectory')}
      </button>
    </section>
  );
};
