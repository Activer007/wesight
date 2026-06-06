import {
  CreatorImageAssetQuality,
  CreatorImageProcessingRisk,
} from '@shared/creatorStudio/constants';
import type { CreatorImageProcessingPlan } from '@shared/creatorStudio/imageProcessingTypes';
import React from 'react';

import { i18nService } from '../../services/i18n';

const riskClassName = (risk: CreatorImageProcessingRisk): string => {
  switch (risk) {
    case CreatorImageProcessingRisk.High:
      return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300';
    case CreatorImageProcessingRisk.Medium:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case CreatorImageProcessingRisk.Low:
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
};

const getImageSourceQualityLabel = (quality: CreatorImageAssetQuality | undefined): string => {
  switch (quality) {
    case CreatorImageAssetQuality.Original:
      return i18nService.t('creatorImageSourceOriginal');
    case CreatorImageAssetQuality.Thumbnail:
      return i18nService.t('creatorImageSourceThumbnail');
    case CreatorImageAssetQuality.Unknown:
    default:
      return i18nService.t('creatorImageSourceUnknown');
  }
};

export const ImageProcessingPlanCard: React.FC<{
  plan: CreatorImageProcessingPlan;
}> = ({ plan }) => (
  <section className="rounded-lg border border-border bg-surface p-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">{i18nService.t('creatorImageProcessingPlan')}</h3>
        <p className="mt-1 text-xs leading-5 text-secondary">
          {i18nService.t('creatorImageProcessingNoOverwriteHint')}
        </p>
      </div>
      <span className={`rounded-md border px-2 py-1 text-[11px] ${riskClassName(plan.estimatedRisk)}`}>
        {i18nService.t(`creatorImageProcessingRisk${plan.estimatedRisk}`)}
      </span>
    </div>
    <div className="mt-3 space-y-2 text-xs">
      <div className="flex justify-between gap-3">
        <span className="text-muted">{i18nService.t('creatorImageProcessingPreset')}</span>
        <span className="truncate text-right text-secondary">{plan.presetId || i18nService.t('creatorImageProcessingPresetCustom')}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">{i18nService.t('creatorImageProcessingOutputFormat')}</span>
        <span className="text-secondary">{plan.output.format.toUpperCase()}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">{i18nService.t('creatorImageProcessingQuality')}</span>
        <span className="text-secondary">{plan.output.quality ?? i18nService.t('creatorImageUnknown')}</span>
      </div>
      {plan.inputItems.map((item) => (
        <div key={item.id} className="flex justify-between gap-3">
          <span className="text-muted">{i18nService.t('creatorImageProcessingInputSource')}</span>
          <span className="truncate text-right text-secondary">
            {getImageSourceQualityLabel(item.imageSource?.assetQuality)}
          </span>
        </div>
      ))}
      {plan.outputItems.map((item) => (
        <div key={item.inputItemId} className="rounded-lg bg-surface-raised p-2">
          <div className="flex justify-between gap-3">
            <span className="text-muted">{i18nService.t('creatorImageProcessingOutputFile')}</span>
            <span className="truncate text-right text-secondary">{item.fileName}</span>
          </div>
          <div className="mt-1 truncate text-muted">{item.outputPath}</div>
        </div>
      ))}
    </div>
    {plan.warnings.length > 0 && (
      <div className="mt-3 space-y-1">
        {plan.warnings.map((warning) => (
          <div key={`${warning.code}-${JSON.stringify(warning.details ?? {})}`} className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            {warning.messageKey ? i18nService.t(warning.messageKey) : warning.code}
          </div>
        ))}
      </div>
    )}
  </section>
);
