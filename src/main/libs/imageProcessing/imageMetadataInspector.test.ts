import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import sharp from 'sharp';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { CreatorImageMetadataStatus } from '../../../shared/creatorStudio/constants';
import { inspectImageMetadata } from './imageMetadataInspector';
import { ImageProcessingErrorCode } from './imageProcessingErrors';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(tmpdir(), `wesight-image-metadata-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test('reads png metadata', async () => {
  const filePath = path.join(tempDir, 'sample.png');
  await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 },
    },
  }).png().toFile(filePath);

  const metadata = await inspectImageMetadata(filePath);

  expect(metadata.status).toBe(CreatorImageMetadataStatus.Ready);
  expect(metadata.width).toBe(32);
  expect(metadata.height).toBe(24);
  expect(metadata.format).toBe('png');
  expect(metadata.mimeType).toBe('image/png');
  expect(metadata.hasAlpha).toBe(true);
  expect(metadata.fileSize).toBeGreaterThan(0);
});

test('reads jpeg metadata', async () => {
  const filePath = path.join(tempDir, 'sample.jpg');
  await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  }).jpeg().toFile(filePath);

  const metadata = await inspectImageMetadata(filePath);

  expect(metadata.status).toBe(CreatorImageMetadataStatus.Ready);
  expect(metadata.width).toBe(40);
  expect(metadata.height).toBe(30);
  expect(metadata.format).toBe('jpeg');
  expect(metadata.mimeType).toBe('image/jpeg');
  expect(metadata.fileSize).toBeGreaterThan(0);
});

test('reads webp metadata', async () => {
  const filePath = path.join(tempDir, 'sample.webp');
  await sharp({
    create: {
      width: 18,
      height: 12,
      channels: 4,
      background: { r: 0, g: 0, b: 255, alpha: 1 },
    },
  }).webp().toFile(filePath);

  const metadata = await inspectImageMetadata(filePath);

  expect(metadata.status).toBe(CreatorImageMetadataStatus.Ready);
  expect(metadata.width).toBe(18);
  expect(metadata.height).toBe(12);
  expect(metadata.format).toBe('webp');
  expect(metadata.mimeType).toBe('image/webp');
  expect(metadata.fileSize).toBeGreaterThan(0);
});

test('returns typed metadata for missing files', async () => {
  const metadata = await inspectImageMetadata(path.join(tempDir, 'missing.png'));

  expect(metadata.status).toBe(CreatorImageMetadataStatus.Missing);
  expect(metadata.fileSize).toBe(0);
  expect(metadata.errorCode).toBe(ImageProcessingErrorCode.MissingFile);
});

test('returns typed metadata for corrupt images', async () => {
  const filePath = path.join(tempDir, 'corrupt.png');
  await writeFile(filePath, Buffer.from('not a real image'));

  const metadata = await inspectImageMetadata(filePath);

  expect(metadata.status).toBe(CreatorImageMetadataStatus.Corrupt);
  expect(metadata.errorCode).toBe(ImageProcessingErrorCode.CorruptImage);
});
