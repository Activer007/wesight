import { mkdir, readFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import sharp from 'sharp';
import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  CreatorImageProcessingOutputFormat,
  CreatorImageQuickEditSaveMode,
} from '../../../shared/creatorStudio/constants';
import { executeImageQuickEdit } from './imageQuickEditService';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(tmpdir(), `wesight-image-quick-edit-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const createImage = async (fileName: string, width = 80, height = 40): Promise<string> => {
  const filePath = path.join(tempDir, fileName);
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 200 },
    },
  }).png().toFile(filePath);
  return filePath;
};

test('saves a resized copy without overwriting the source', async () => {
  const sourcePath = await createImage('copy.png', 100, 50);
  const sourceBytes = await readFile(sourcePath);

  const result = await executeImageQuickEdit({
    sourceAssetId: 'asset-1',
    sourcePath,
    saveMode: CreatorImageQuickEditSaveMode.Copy,
    outputFormat: CreatorImageProcessingOutputFormat.Webp,
    width: 50,
    keepAspect: true,
  });

  expect(result.outputPath).toBe(path.join(tempDir, 'copy-edited.webp'));
  expect(await readFile(sourcePath)).toEqual(sourceBytes);
  const metadata = await sharp(result.outputPath).metadata();
  expect(metadata.format).toBe(CreatorImageProcessingOutputFormat.Webp);
  expect(metadata.width).toBe(50);
  expect(metadata.height).toBe(25);
});

test('exports with a unique name when the target already exists', async () => {
  const sourcePath = await createImage('export.png');
  const outputDirectory = path.join(tempDir, 'exports');
  await mkdir(outputDirectory, { recursive: true });
  await createImage(path.join('exports', 'export.webp'));

  const result = await executeImageQuickEdit({
    sourceAssetId: 'asset-1',
    sourcePath,
    saveMode: CreatorImageQuickEditSaveMode.Export,
    outputDirectory,
    outputFormat: CreatorImageProcessingOutputFormat.Webp,
  });

  expect(result.outputPath).toBe(path.join(outputDirectory, 'export-1.webp'));
});

test('save_as writes to the requested output path', async () => {
  const sourcePath = await createImage('save-as.png');
  const outputPath = path.join(tempDir, 'chosen.jpg');

  const result = await executeImageQuickEdit({
    sourceAssetId: 'asset-1',
    sourcePath,
    saveMode: CreatorImageQuickEditSaveMode.SaveAs,
    outputPath,
    outputFormat: CreatorImageProcessingOutputFormat.Jpeg,
    quality: 60,
  });

  expect(result.outputPath).toBe(outputPath);
  expect((await sharp(outputPath).metadata()).format).toBe('jpeg');
});

test('overwrites the source through a temporary file', async () => {
  const sourcePath = await createImage('overwrite.png', 60, 30);
  const before = await stat(sourcePath);

  const result = await executeImageQuickEdit({
    sourceAssetId: 'asset-1',
    sourcePath,
    saveMode: CreatorImageQuickEditSaveMode.Overwrite,
    rotate: 90,
    outputFormat: CreatorImageProcessingOutputFormat.Png,
  });

  const metadata = await sharp(sourcePath).metadata();
  expect(result.outputPath).toBe(sourcePath);
  expect(result.overwritten).toBe(true);
  expect(metadata.width).toBe(30);
  expect(metadata.height).toBe(60);
  expect((await stat(sourcePath)).mtimeMs).toBeGreaterThanOrEqual(before.mtimeMs);
});
