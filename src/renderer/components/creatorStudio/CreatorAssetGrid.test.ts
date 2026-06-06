import {
  CreatorAssetAdoptionStatus,
  CreatorImageAssetQuality,
  CreatorProductionAssetKind,
  CreatorProductionAssetSource,
  CreatorProductionAssetStatus,
} from '@shared/creatorStudio/constants';
import type { CreatorProductionAssetRecord } from '@shared/creatorStudio/types';
import { expect, test } from 'vitest';

import {
  canPostProcessAsset,
  hasProcessableCreatorImageSource,
} from './CreatorAssetGrid';

const createAsset = (
  overrides: Partial<CreatorProductionAssetRecord> = {},
): CreatorProductionAssetRecord => ({
  id: 'asset-1',
  projectId: 'project-1',
  kind: CreatorProductionAssetKind.Image,
  status: CreatorProductionAssetStatus.Ready,
  source: CreatorProductionAssetSource.LocalImageImport,
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
  filePath: '/tmp/source.png',
  fileName: 'source.png',
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
  ...overrides,
});

test('allows image post processing for local image assets', () => {
  const asset = createAsset();

  expect(hasProcessableCreatorImageSource(asset)).toBe(true);
  expect(canPostProcessAsset(asset)).toBe(true);
});

test('allows image post processing for virtual case image assets with remote sources', () => {
  const asset = createAsset({
    source: CreatorProductionAssetSource.CreatorCase,
    filePath: 'creator://case-image/case-1',
    imageSource: {
      assetQuality: CreatorImageAssetQuality.Thumbnail,
      localPath: 'creator://case-image/case-1',
      originalPath: null,
      thumbnailPath: null,
      originalUrl: 'https://example.com/original.jpg',
      thumbnailUrl: './creator-studio/images/case206.jpg',
      provider: CreatorProductionAssetSource.CreatorCase,
      resolvedPath: null,
      resolvedReason: null,
      downloadedAt: null,
      downloadError: null,
    },
  });

  expect(hasProcessableCreatorImageSource(asset)).toBe(true);
  expect(canPostProcessAsset(asset)).toBe(true);
});

test('rejects image post processing when no image source can be resolved', () => {
  const asset = createAsset({
    status: CreatorProductionAssetStatus.Missing,
    filePath: 'creator://missing/image',
    imageSource: null,
  });

  expect(hasProcessableCreatorImageSource(asset)).toBe(false);
  expect(canPostProcessAsset(asset)).toBe(false);
});
