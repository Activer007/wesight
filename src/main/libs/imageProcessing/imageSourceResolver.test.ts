import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  CreatorAssetAdoptionStatus,
  CreatorImageAssetQuality,
  CreatorProductionAssetKind,
  CreatorProductionAssetSource,
  CreatorProductionAssetStatus,
} from '../../../shared/creatorStudio/constants';
import type { CreatorProductionAssetRecord } from '../../../shared/creatorStudio/types';
import {
  buildCreatorImageSourceFile,
  resolveCreatorImageSourceForProcessing,
} from './imageSourceResolver';

const originalFetch = globalThis.fetch;
let tempDir: string;

const createAsset = (filePath: string): CreatorProductionAssetRecord => ({
  id: 'asset-1',
  projectId: 'project-1',
  kind: CreatorProductionAssetKind.Image,
  status: CreatorProductionAssetStatus.Ready,
  source: CreatorProductionAssetSource.CoworkGeneratedImage,
  runId: null,
  variantOfAssetId: null,
  sessionId: null,
  messageId: null,
  templateId: null,
  caseIds: [],
  promptSpec: null,
  promptText: '',
  parentPromptAssetId: null,
  promptVersionId: null,
  recipeId: null,
  selectedDirectionId: null,
  filePath,
  fileName: path.basename(filePath),
  mimeType: 'image/png',
  favorite: false,
  adoptionStatus: CreatorAssetAdoptionStatus.Unset,
  tags: [],
  collectionIds: [],
  selected: false,
  licenseNote: null,
  usageNote: null,
  createdAt: 1,
  updatedAt: 1,
  sourceSessionAvailable: false,
  imageSource: null,
  imageMetadata: null,
  imageProcessing: null,
});

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wesight-image-source-'));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('uses existing original path before local thumbnails', async () => {
  const thumbnailPath = path.join(tempDir, 'thumb.png');
  const originalPath = path.join(tempDir, 'original.png');
  fs.writeFileSync(thumbnailPath, 'thumb');
  fs.writeFileSync(originalPath, 'original');
  const asset = createAsset(thumbnailPath);
  asset.imageSource = buildCreatorImageSourceFile({
    localPath: thumbnailPath,
    assetQuality: CreatorImageAssetQuality.Thumbnail,
    originalPath,
    thumbnailPath,
  });

  const resolved = await resolveCreatorImageSourceForProcessing(asset);

  expect(resolved.sourcePath).toBe(originalPath);
  expect(resolved.imageSource.assetQuality).toBe(CreatorImageAssetQuality.Original);
  expect(resolved.imageSource.resolvedReason).toBe('original_path');
  expect(resolved.warningCodes).toEqual([]);
});

test('downloads https original images into a user cache', async () => {
  const thumbnailPath = path.join(tempDir, 'thumb.png');
  fs.writeFileSync(thumbnailPath, 'thumb');
  const asset = createAsset(thumbnailPath);
  asset.imageSource = buildCreatorImageSourceFile({
    localPath: thumbnailPath,
    assetQuality: CreatorImageAssetQuality.Thumbnail,
    originalUrl: 'https://example.com/original.png',
  });
  globalThis.fetch = vi.fn(async () => new Response(Buffer.from('original'), {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'content-length': '8',
    },
  })) as typeof fetch;

  const resolved = await resolveCreatorImageSourceForProcessing(asset);

  expect(resolved.imageSource.assetQuality).toBe(CreatorImageAssetQuality.Original);
  expect(resolved.imageSource.resolvedReason).toBe('downloaded_original_url');
  expect(resolved.sourcePath).toContain(path.join('.wesight', 'creator-image-originals'));
  expect(fs.existsSync(resolved.sourcePath)).toBe(true);
});

test('falls back to thumbnail when original download is rejected', async () => {
  const thumbnailPath = path.join(tempDir, 'thumb.png');
  fs.writeFileSync(thumbnailPath, 'thumb');
  const asset = createAsset(thumbnailPath);
  asset.imageSource = buildCreatorImageSourceFile({
    localPath: thumbnailPath,
    assetQuality: CreatorImageAssetQuality.Thumbnail,
    originalUrl: 'http://example.com/original.png',
  });

  const resolved = await resolveCreatorImageSourceForProcessing(asset);

  expect(resolved.sourcePath).toBe(thumbnailPath);
  expect(resolved.imageSource.resolvedReason).toBe('thumbnail_fallback');
  expect(resolved.warningCodes).toEqual([
    'original_download_failed',
    'using_thumbnail_source',
  ]);
  expect(resolved.imageSource.downloadError).toContain('HTTPS');
});

test('falls back from virtual case image paths to bundled thumbnail files', async () => {
  const asset = createAsset('creator://case-image/case206');
  asset.imageSource = buildCreatorImageSourceFile({
    localPath: 'creator://case-image/case206',
    assetQuality: CreatorImageAssetQuality.Thumbnail,
    originalUrl: 'http://example.com/original.png',
    thumbnailUrl: './creator-studio/images/case206.jpg',
  });

  const resolved = await resolveCreatorImageSourceForProcessing(asset);

  expect(resolved.sourcePath).toBe(path.resolve(process.cwd(), 'public', 'creator-studio/images/case206.jpg'));
  expect(resolved.imageSource.resolvedReason).toBe('thumbnail_fallback');
  expect(resolved.warningCodes).toEqual([
    'original_download_failed',
    'using_thumbnail_source',
  ]);
});

test('falls back to built renderer assets when public bundled thumbnails are unavailable', async () => {
  const assetName = `resolver-dist-only-${Date.now()}.jpg`;
  const distPath = path.resolve(process.cwd(), 'dist', 'creator-studio', 'images', assetName);
  fs.mkdirSync(path.dirname(distPath), { recursive: true });
  fs.writeFileSync(distPath, 'thumbnail');
  const asset = createAsset('creator://case-image/case-dist-only');
  asset.imageSource = buildCreatorImageSourceFile({
    localPath: 'creator://case-image/case-dist-only',
    assetQuality: CreatorImageAssetQuality.Thumbnail,
    thumbnailUrl: `./creator-studio/images/${assetName}`,
  });

  try {
    const resolved = await resolveCreatorImageSourceForProcessing(asset);

    expect(resolved.sourcePath).toBe(distPath);
    expect(resolved.imageSource.resolvedReason).toBe('thumbnail_fallback');
  } finally {
    fs.rmSync(distPath, { force: true });
  }
});

test('can inspect local thumbnails without downloading remote originals', async () => {
  const thumbnailPath = path.join(tempDir, 'thumb.png');
  fs.writeFileSync(thumbnailPath, 'thumb');
  const asset = createAsset(thumbnailPath);
  asset.imageSource = buildCreatorImageSourceFile({
    localPath: thumbnailPath,
    assetQuality: CreatorImageAssetQuality.Thumbnail,
    originalUrl: 'https://example.com/original.png',
  });
  globalThis.fetch = vi.fn() as typeof fetch;

  const resolved = await resolveCreatorImageSourceForProcessing(asset, {
    allowDownloadOriginal: false,
  });

  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(resolved.sourcePath).toBe(thumbnailPath);
  expect(resolved.imageSource.resolvedReason).toBe('thumbnail_fallback');
  expect(resolved.warningCodes).toEqual(['using_thumbnail_source']);
});
