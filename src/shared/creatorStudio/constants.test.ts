import { expect, test } from 'vitest';

import {
  CreatorBatchRunKind,
  CreatorFeatureFlag,
  CreatorFeatureFlagDefaults,
  CreatorImageMetadataStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOperation,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingPlanSchemaVersion,
  CreatorImageProcessingPlanStatus,
  CreatorImageProcessingRisk,
  CreatorImageProcessingSourceKind,
  CreatorImageProcessingTaskStatus,
  CreatorProductionAssetSource,
  isCreatorBatchRunKind,
  isCreatorFeatureFlag,
  isCreatorImageMetadataStatus,
  isCreatorImageProcessingCreatedBy,
  isCreatorImageProcessingJobStatus,
  isCreatorImageProcessingOperation,
  isCreatorImageProcessingOutputFormat,
  isCreatorImageProcessingPlanSchemaVersion,
  isCreatorImageProcessingPlanStatus,
  isCreatorImageProcessingRisk,
  isCreatorImageProcessingSourceKind,
  isCreatorImageProcessingTaskStatus,
  isCreatorProductionAssetSource,
  resolveCreatorFeatureFlag,
} from './constants';

test('accepts creator image processing constants through type guards', () => {
  expect(isCreatorFeatureFlag(CreatorFeatureFlag.ImageProcessingEnabled)).toBe(true);
  expect(isCreatorProductionAssetSource(CreatorProductionAssetSource.LocalImageProcessing)).toBe(true);
  expect(isCreatorProductionAssetSource(CreatorProductionAssetSource.RecipePostProcessing)).toBe(true);
  expect(isCreatorBatchRunKind(CreatorBatchRunKind.ImageProcessing)).toBe(true);
  expect(isCreatorImageMetadataStatus(CreatorImageMetadataStatus.Ready)).toBe(true);
  expect(isCreatorImageProcessingSourceKind(CreatorImageProcessingSourceKind.CreatorAsset)).toBe(true);
  expect(isCreatorImageProcessingPlanStatus(CreatorImageProcessingPlanStatus.Ready)).toBe(true);
  expect(isCreatorImageProcessingJobStatus(CreatorImageProcessingJobStatus.Pending)).toBe(true);
  expect(isCreatorImageProcessingTaskStatus(CreatorImageProcessingTaskStatus.Pending)).toBe(true);
  expect(isCreatorImageProcessingOperation(CreatorImageProcessingOperation.Resize)).toBe(true);
  expect(isCreatorImageProcessingOutputFormat(CreatorImageProcessingOutputFormat.Webp)).toBe(true);
  expect(isCreatorImageProcessingPlanSchemaVersion(CreatorImageProcessingPlanSchemaVersion.V1)).toBe(true);
  expect(isCreatorImageProcessingRisk(CreatorImageProcessingRisk.Low)).toBe(true);
  expect(isCreatorImageProcessingCreatedBy(CreatorImageProcessingCreatedBy.User)).toBe(true);
});

test('rejects non-string image processing constants', () => {
  expect(isCreatorFeatureFlag(null)).toBe(false);
  expect(isCreatorBatchRunKind(undefined)).toBe(false);
  expect(isCreatorImageMetadataStatus(Symbol('status'))).toBe(false);
  expect(isCreatorImageProcessingSourceKind({})).toBe(false);
  expect(isCreatorImageProcessingPlanStatus(1)).toBe(false);
  expect(isCreatorImageProcessingJobStatus(false)).toBe(false);
  expect(isCreatorImageProcessingTaskStatus([])).toBe(false);
  expect(isCreatorImageProcessingOperation(null)).toBe(false);
  expect(isCreatorImageProcessingOutputFormat(undefined)).toBe(false);
  expect(isCreatorImageProcessingPlanSchemaVersion({})).toBe(false);
  expect(isCreatorImageProcessingRisk(1)).toBe(false);
  expect(isCreatorImageProcessingCreatedBy(false)).toBe(false);
});

test('resolves creator feature flags with defaults and boolean overrides', () => {
  expect(CreatorFeatureFlagDefaults[CreatorFeatureFlag.ImageProcessingEnabled]).toBe(false);
  expect(resolveCreatorFeatureFlag(null, CreatorFeatureFlag.ImageProcessingEnabled)).toBe(false);
  expect(resolveCreatorFeatureFlag([], CreatorFeatureFlag.ImageProcessingEnabled)).toBe(false);
  expect(resolveCreatorFeatureFlag({
    [CreatorFeatureFlag.ImageProcessingEnabled]: true,
  }, CreatorFeatureFlag.ImageProcessingEnabled)).toBe(true);
  expect(resolveCreatorFeatureFlag({
    [CreatorFeatureFlag.ImageProcessingEnabled]: 'true',
  }, CreatorFeatureFlag.ImageProcessingEnabled)).toBe(false);
});
