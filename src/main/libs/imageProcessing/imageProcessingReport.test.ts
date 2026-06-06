import { describe, expect, test } from 'vitest';

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
  CreatorImageProcessingJob,
  CreatorImageProcessingPlan,
  CreatorImageProcessingTask,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import {
  calculateImageProcessingSavedPercentage,
  createImageProcessingReport,
  summarizeImageProcessingFailureReasons,
} from './imageProcessingReport';

describe('imageProcessingReport', () => {
  test('calculates saved percentage', () => {
    expect(calculateImageProcessingSavedPercentage(1000, 250)).toBe(25);
    expect(calculateImageProcessingSavedPercentage(0, 250)).toBe(0);
  });

  test('summarizes failure reasons', () => {
    const reasons = summarizeImageProcessingFailureReasons([
      createTask({ id: 'task-a', errorCode: 'corrupt_image', errorMessage: 'Cannot decode' }),
      createTask({ id: 'task-b', errorCode: 'corrupt_image', errorMessage: 'Cannot decode' }),
      createTask({ id: 'task-c', errorCode: 'missing_file', errorMessage: 'Missing' }),
    ]);

    expect(reasons).toEqual([
      { code: 'corrupt_image', message: 'Cannot decode', count: 2 },
      { code: 'missing_file', message: 'Missing', count: 1 },
    ]);
  });

  test('renders markdown report without base64 payloads or per-input path list', () => {
    const plan = createPlan();
    const job = createJob();
    const report = createImageProcessingReport({
      plan,
      job,
      tasks: [
        createTask({ id: 'task-ok', status: CreatorImageProcessingTaskStatus.Completed }),
        createTask({
          id: 'task-failed',
          status: CreatorImageProcessingTaskStatus.Failed,
          errorCode: 'corrupt_image',
          errorMessage: 'data:image/png;base64,AAAA failed',
        }),
      ],
      reportPath: '/tmp/report.md',
      now: 10,
    });

    expect(report.metrics.backend).toBe('sharp');
    expect(report.metrics.savedPercentage).toBe(25);
    expect(report.markdown).toContain('Input images: 2');
    expect(report.markdown).toContain('Success / failed: 1 / 1');
    expect(report.markdown).toContain('Saved size: 250 B (25.00%)');
    expect(report.markdown).toContain('Output format: webp');
    expect(report.markdown).toContain('Preset: custom');
    expect(report.markdown).toContain('Output directory: /tmp/out');
    expect(report.markdown).toContain('[redacted-base64]');
    expect(report.markdown).not.toContain('/tmp/source-a.png');
    expect(report.markdown).not.toMatch(/base64,/i);
  });
});

const createPlan = (): CreatorImageProcessingPlan => ({
  schemaVersion: CreatorImageProcessingPlanSchemaVersion.V1,
  id: 'plan-report',
  projectId: 'project-report',
  source: { sourceKind: CreatorImageProcessingSourceKind.CreatorAsset, assetId: 'asset-a' },
  inputItems: [
    {
      id: 'input-a',
      source: { sourceKind: CreatorImageProcessingSourceKind.CreatorAsset, assetId: 'asset-a' },
      sourceAssetId: 'asset-a',
      sourcePath: '/tmp/source-a.png',
      metadata: {
        sourcePath: '/tmp/source-a.png',
        width: 100,
        height: 80,
        fileSize: 500,
        format: 'png',
        mimeType: 'image/png',
        hasAlpha: false,
        exifOrientation: null,
        colorSpace: 'srgb',
        inspectedAt: 1,
        status: CreatorImageMetadataStatus.Ready,
        warningCodes: [],
      },
    },
  ],
  presetId: null,
  operations: [
    { id: 'auto-orient', operation: CreatorImageProcessingOperation.AutoOrient, params: {} },
    { id: 'convert-webp', operation: CreatorImageProcessingOperation.Convert, params: { format: CreatorImageProcessingOutputFormat.Webp } },
  ],
  output: {
    format: CreatorImageProcessingOutputFormat.Webp,
    quality: 82,
    outputDirectory: '/tmp/out',
    fileNamePattern: '{name}.webp',
    overwrite: false,
  },
  outputItems: [
    {
      inputItemId: 'input-a',
      sourceAssetId: 'asset-a',
      outputDirectory: '/tmp/out',
      fileName: 'source-a.webp',
      outputPath: '/tmp/out/source-a.webp',
      width: 100,
      height: 80,
      format: CreatorImageProcessingOutputFormat.Webp,
    },
  ],
  warnings: [],
  estimatedRisk: CreatorImageProcessingRisk.Low,
  createdBy: CreatorImageProcessingCreatedBy.User,
  status: CreatorImageProcessingPlanStatus.Ready,
  createdAt: 1,
  updatedAt: 1,
});

const createJob = (): CreatorImageProcessingJob => ({
  id: 'job-report',
  projectId: 'project-report',
  planId: 'plan-report',
  status: CreatorImageProcessingJobStatus.PartialFailed,
  totalCount: 2,
  successCount: 1,
  failedCount: 1,
  inputTotalSize: 1000,
  outputTotalSize: 750,
  savedSize: 250,
  savedPercentage: 25,
  runtimeMetrics: null,
  reportAssetId: null,
  reportPath: null,
  createdAt: 1,
  startedAt: 2,
  completedAt: 102,
});

const createTask = (input: Partial<CreatorImageProcessingTask> & { id: string }): CreatorImageProcessingTask => ({
  id: input.id,
  jobId: 'job-report',
  projectId: 'project-report',
  sourceAssetId: 'asset-a',
  outputAssetId: null,
  sourceArtifactId: null,
  sourcePath: '/tmp/source-a.png',
  outputPath: '/tmp/out/source-a.webp',
  status: input.status ?? CreatorImageProcessingTaskStatus.Failed,
  inputSize: 500,
  outputSize: input.status === CreatorImageProcessingTaskStatus.Completed ? 350 : null,
  durationMs: 50,
  errorCode: input.errorCode ?? null,
  errorMessage: input.errorMessage ?? null,
  createdAt: 1,
  updatedAt: 2,
  completedAt: 2,
});
