import { expect, test } from 'vitest';

import {
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
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageMetadata,
  CreatorImageProcessingInputItem,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import { ImageProcessingError } from './imageProcessingErrors';
import { createImageProcessingPlan } from './imageProcessingPlanner';
import {
  CreatorImageProcessingPresetId,
  getCreatorImageProcessingPreset,
} from './imageProcessingPresets';
import { createImageProcessingService } from './imageProcessingService';

const createMetadata = (overrides: Partial<CreatorImageMetadata> = {}): CreatorImageMetadata => ({
  sourcePath: '/workspace/image.png',
  width: 1600,
  height: 900,
  fileSize: 2048,
  format: CreatorImageProcessingOutputFormat.Png,
  mimeType: 'image/png',
  hasAlpha: false,
  exifOrientation: null,
  colorSpace: 'srgb',
  inspectedAt: 123,
  status: CreatorImageMetadataStatus.Ready,
  warningCodes: [],
  ...overrides,
});

const createInputItem = (metadata = createMetadata()): CreatorImageProcessingInputItem => ({
  id: 'input-1',
  source: {
    sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
    assetId: 'asset-1',
  },
  sourceAssetId: 'asset-1',
  sourcePath: metadata.sourcePath,
  metadata,
});

test('expands the web optimized preset into a ready non-overwriting plan', () => {
  const plan = createImageProcessingPlan({
    id: 'plan-1',
    projectId: ' project-1 ',
    source: {
      sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
      assetId: 'asset-1',
    },
    inputItems: [createInputItem()],
    presetId: CreatorImageProcessingPresetId.WebOptimizedWebp,
    createdBy: CreatorImageProcessingCreatedBy.User,
    now: 456,
  });

  expect(plan.schemaVersion).toBe(CreatorImageProcessingPlanSchemaVersion.V1);
  expect(plan.projectId).toBe('project-1');
  expect(plan.status).toBe(CreatorImageProcessingPlanStatus.Ready);
  expect(plan.output.format).toBe(CreatorImageProcessingOutputFormat.Webp);
  expect(plan.output.overwrite).toBe(false);
  expect(plan.outputItems[0]).toMatchObject({
    fileName: 'image.web-optimized.1600w.webp',
    width: 1600,
    height: 900,
    format: CreatorImageProcessingOutputFormat.Webp,
  });
  expect(plan.outputItems[0].outputPath).toContain('.wesight/creator-outputs/image-processing/plan-1');
  expect(plan.operations.map((operation) => operation.operation)).toEqual([
    CreatorImageProcessingOperation.AutoOrient,
    CreatorImageProcessingOperation.Resize,
    CreatorImageProcessingOperation.Convert,
  ]);
  expect(plan.estimatedRisk).toBe(CreatorImageProcessingRisk.Low);
  expect(plan.createdAt).toBe(456);
  expect(plan.updatedAt).toBe(456);
});

test('adds risk warnings for alpha images converted to jpeg', () => {
  const plan = createImageProcessingPlan({
    id: 'plan-1',
    projectId: 'project-1',
    source: {
      sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
      assetId: 'asset-1',
    },
    inputItems: [createInputItem(createMetadata({ hasAlpha: true }))],
    output: {
      format: CreatorImageProcessingOutputFormat.Jpeg,
      quality: 80,
      outputDirectory: null,
      fileNamePattern: '{name}.jpeg',
      overwrite: false,
    },
    now: 456,
  });

  expect(plan.warnings).toEqual([expect.objectContaining({
    severity: CreatorImageProcessingRisk.Medium,
  })]);
  expect(plan.estimatedRisk).toBe(CreatorImageProcessingRisk.Medium);
});

test('rejects unknown image processing presets', () => {
  expect(() => createImageProcessingPlan({
    projectId: 'project-1',
    source: {
      sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
      assetId: 'asset-1',
    },
    inputItems: [createInputItem()],
    presetId: 'unsupported-preset',
  })).toThrow(ImageProcessingError);
});

test('keeps preset definitions available without executing image work', () => {
  const preset = getCreatorImageProcessingPreset(CreatorImageProcessingPresetId.ReadmeBanner);

  expect(preset?.output.format).toBe(CreatorImageProcessingOutputFormat.Webp);
  expect(preset?.operationSteps.some((step) => (
    step.operation === CreatorImageProcessingOperation.Resize
  ))).toBe(true);
});

test('creates failed job state without mutating source when execution cannot read input', async () => {
  const service = createImageProcessingService();
  const plan = service.createPlan({
    id: 'plan-1',
    projectId: 'project-1',
    source: {
      sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
      assetId: 'asset-1',
    },
    inputItems: [createInputItem()],
    now: 456,
  });

  const job = service.createJobShell(plan);
  const task = service.createTaskShell(job, plan, 0);

  expect(job.planId).toBe(plan.id);
  expect(task.sourceAssetId).toBe('asset-1');
  const result = await service.executePlan(plan);
  expect(result.job.status).toBe(CreatorImageProcessingJobStatus.Failed);
  expect(result.tasks[0].status).toBe(CreatorImageProcessingTaskStatus.Failed);
  expect(result.outputAssets).toEqual([]);
});
