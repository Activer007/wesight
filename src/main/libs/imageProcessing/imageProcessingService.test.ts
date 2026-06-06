import { mkdir, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import sharp from 'sharp';
import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  CreatorImageMetadataStatus,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOperation,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingSourceKind,
  CreatorImageProcessingTaskStatus,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageMetadata,
  CreatorImageProcessingInputItem,
  CreatorImageProcessingOperationStep,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import { ImageProcessingErrorCode } from './imageProcessingErrors';
import { createImageProcessingPlan } from './imageProcessingPlanner';
import { createImageProcessingService } from './imageProcessingService';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(tmpdir(), `wesight-image-processing-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const createSourceImage = async (
  fileName: string,
  width: number,
  height: number,
): Promise<{ filePath: string; metadata: CreatorImageMetadata }> => {
  const filePath = path.join(tempDir, fileName);
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 200 },
    },
  }).png().toFile(filePath);
  const fileStat = await stat(filePath);
  return {
    filePath,
    metadata: {
      sourcePath: filePath,
      width,
      height,
      fileSize: fileStat.size,
      format: CreatorImageProcessingOutputFormat.Png,
      mimeType: 'image/png',
      hasAlpha: false,
      exifOrientation: null,
      colorSpace: 'srgb',
      inspectedAt: Date.now(),
      status: CreatorImageMetadataStatus.Ready,
      warningCodes: [],
    },
  };
};

const createInputItem = (sourcePath: string, metadata: CreatorImageMetadata): CreatorImageProcessingInputItem => ({
  id: 'input-1',
  source: {
    sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
    assetId: 'asset-1',
  },
  sourceAssetId: 'asset-1',
  sourcePath,
  metadata,
});

const execute = async (
  fileName: string,
  operations: CreatorImageProcessingOperationStep[],
  outputFormat: CreatorImageProcessingOutputFormat,
  width = 800,
  height = 600,
) => {
  const source = await createSourceImage(fileName, width, height);
  const plan = createImageProcessingPlan({
    id: `plan-${fileName}`,
    projectId: 'project-1',
    source: {
      sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
      assetId: 'asset-1',
    },
    inputItems: [createInputItem(source.filePath, source.metadata)],
    operations,
    output: {
      format: outputFormat,
      quality: 80,
      outputDirectory: path.join(tempDir, 'outputs'),
      fileNamePattern: '{name}.{width}x{height}.{format}',
      overwrite: false,
    },
  });

  const service = createImageProcessingService();
  const result = await service.executePlan(plan);
  const outputPath = result.tasks[0].outputPath!;
  const metadata = await sharp(outputPath).metadata();
  return { result, outputPath, metadata };
};

test('converts a single image to webp', async () => {
  const { result, metadata } = await execute('convert.png', [
    { id: 'convert-webp', operation: CreatorImageProcessingOperation.Convert, params: { format: CreatorImageProcessingOutputFormat.Webp, quality: 80 } },
  ], CreatorImageProcessingOutputFormat.Webp);

  expect(result.job.status).toBe(CreatorImageProcessingJobStatus.Completed);
  expect(result.tasks[0].status).toBe(CreatorImageProcessingTaskStatus.Completed);
  expect(metadata.format).toBe(CreatorImageProcessingOutputFormat.Webp);
});

test('resizes a single image inside max dimensions', async () => {
  const { metadata } = await execute('resize.png', [
    {
      id: 'resize',
      operation: CreatorImageProcessingOperation.Resize,
      params: { maxWidth: 400, maxHeight: 400, fit: 'inside', withoutEnlargement: true },
    },
  ], CreatorImageProcessingOutputFormat.Webp, 800, 600);

  expect(metadata.width).toBe(400);
  expect(metadata.height).toBe(300);
});

test('crops a readme banner ratio through cover resize', async () => {
  const { metadata } = await execute('banner.png', [
    {
      id: 'resize-readme-banner',
      operation: CreatorImageProcessingOperation.Resize,
      params: { width: 1600, height: 800, fit: 'cover' },
    },
  ], CreatorImageProcessingOutputFormat.Webp, 1200, 1200);

  expect(metadata.width).toBe(1600);
  expect(metadata.height).toBe(800);
});

test('rotates a single image', async () => {
  const { metadata } = await execute('rotate.png', [
    { id: 'rotate-90', operation: CreatorImageProcessingOperation.Rotate, params: { angle: 90 } },
  ], CreatorImageProcessingOutputFormat.Png, 30, 50);

  expect(metadata.width).toBe(50);
  expect(metadata.height).toBe(30);
});

test('does not overwrite an existing output file', async () => {
  const source = await createSourceImage('overwrite.png', 100, 80);
  const outputDirectory = path.join(tempDir, 'outputs');
  await mkdir(outputDirectory, { recursive: true });
  const existingOutputPath = path.join(outputDirectory, 'overwrite.100x80.webp');
  await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  }).webp().toFile(existingOutputPath);

  const plan = createImageProcessingPlan({
    id: 'plan-overwrite',
    projectId: 'project-1',
    source: {
      sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
      assetId: 'asset-1',
    },
    inputItems: [createInputItem(source.filePath, source.metadata)],
    output: {
      format: CreatorImageProcessingOutputFormat.Webp,
      quality: 80,
      outputDirectory,
      fileNamePattern: '{name}.{width}x{height}.{format}',
      overwrite: false,
    },
  });

  const service = createImageProcessingService();
  const result = await service.executePlan(plan);

  expect(result.job.status).toBe(CreatorImageProcessingJobStatus.Failed);
  expect(result.tasks[0].errorCode).toBe(ImageProcessingErrorCode.OutputExists);
});
