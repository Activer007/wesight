import { createHash } from 'crypto';
import fs from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  CreatorImageAssetQuality,
  isCreatorImageAssetQuality,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageSourceFile,
  CreatorProductionAssetRecord,
} from '../../../shared/creatorStudio/types';

const MaxOriginalDownloadBytes = 50 * 1024 * 1024;
const DownloadTimeoutMs = 20_000;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const toOptionalString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const toOptionalNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const normalizeLocalPath = (value: string | null): string | null => (
  value
    ? value.startsWith('creator://')
      ? value
      : path.resolve(value)
    : null
);

const resolveBundledCreatorImagePath = (value: string | null): string | null => {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized.startsWith('creator-studio/images/')) return null;
  return path.resolve(process.cwd(), 'public', normalized);
};

export const parseCreatorImageSourceFile = (
  metadata: Record<string, unknown>,
  fallbackLocalPath: string,
): CreatorImageSourceFile | null => {
  const value = metadata.imageSource;
  if (!isRecord(value)) return null;
  const assetQuality = isCreatorImageAssetQuality(value.assetQuality)
    ? value.assetQuality
    : CreatorImageAssetQuality.Unknown;
  return {
    assetQuality,
    localPath: normalizeLocalPath(toOptionalString(value.localPath) ?? fallbackLocalPath),
    originalPath: normalizeLocalPath(toOptionalString(value.originalPath)),
    thumbnailPath: normalizeLocalPath(toOptionalString(value.thumbnailPath)),
    originalUrl: toOptionalString(value.originalUrl),
    thumbnailUrl: toOptionalString(value.thumbnailUrl),
    provider: toOptionalString(value.provider),
    resolvedPath: normalizeLocalPath(toOptionalString(value.resolvedPath)),
    resolvedReason: toOptionalString(value.resolvedReason),
    downloadedAt: toOptionalNumber(value.downloadedAt),
    downloadError: toOptionalString(value.downloadError),
  };
};

export const buildCreatorImageSourceFile = (input: {
  localPath: string;
  assetQuality?: CreatorImageAssetQuality;
  originalPath?: string | null;
  thumbnailPath?: string | null;
  originalUrl?: string | null;
  thumbnailUrl?: string | null;
  provider?: string | null;
  resolvedPath?: string | null;
  resolvedReason?: string | null;
  downloadedAt?: number | null;
  downloadError?: string | null;
}): CreatorImageSourceFile => ({
  assetQuality: input.assetQuality ?? CreatorImageAssetQuality.Unknown,
  localPath: normalizeLocalPath(input.localPath),
  originalPath: normalizeLocalPath(input.originalPath ?? null),
  thumbnailPath: normalizeLocalPath(input.thumbnailPath ?? null),
  originalUrl: input.originalUrl?.trim() || null,
  thumbnailUrl: input.thumbnailUrl?.trim() || null,
  provider: input.provider?.trim() || null,
  resolvedPath: normalizeLocalPath(input.resolvedPath ?? null),
  resolvedReason: input.resolvedReason?.trim() || null,
  downloadedAt: input.downloadedAt ?? null,
  downloadError: input.downloadError?.trim() || null,
});

export interface ResolvedCreatorImageSource {
  sourcePath: string;
  imageSource: CreatorImageSourceFile;
  warningCodes: string[];
}

export interface ResolveCreatorImageSourceOptions {
  allowDownloadOriginal?: boolean;
}

const getCacheDirectory = (): string => (
  path.join(os.homedir(), '.wesight', 'creator-image-originals')
);

const getExtensionFromContentType = (contentType: string | null): string => {
  const clean = contentType?.split(';')[0]?.trim().toLowerCase();
  switch (clean) {
    case 'image/avif':
      return '.avif';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.img';
  }
};

const downloadOriginalImage = async (url: string): Promise<string> => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS image URLs can be downloaded');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DownloadTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Image download failed with HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type');
    if (!contentType?.toLowerCase().startsWith('image/')) {
      throw new Error('Downloaded resource is not an image');
    }
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (contentLength > MaxOriginalDownloadBytes) {
      throw new Error('Original image is too large to download');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MaxOriginalDownloadBytes) {
      throw new Error('Original image is too large to download');
    }
    const hash = createHash('sha256').update(url).digest('hex').slice(0, 24);
    const filePath = path.join(getCacheDirectory(), `${hash}${getExtensionFromContentType(contentType)}`);
    await mkdir(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      await writeFile(filePath, buffer);
    }
    return filePath;
  } finally {
    clearTimeout(timeout);
  }
};

export const resolveCreatorImageSourceForProcessing = async (
  asset: CreatorProductionAssetRecord,
  options: ResolveCreatorImageSourceOptions = {},
): Promise<ResolvedCreatorImageSource> => {
  const allowDownloadOriginal = options.allowDownloadOriginal ?? true;
  const current = asset.imageSource ?? buildCreatorImageSourceFile({
    localPath: asset.filePath,
    assetQuality: CreatorImageAssetQuality.Unknown,
    provider: asset.source,
  });
  const warningCodes: string[] = [];

  if (current.originalPath && fs.existsSync(current.originalPath)) {
    return {
      sourcePath: current.originalPath,
      imageSource: {
        ...current,
        assetQuality: CreatorImageAssetQuality.Original,
        resolvedPath: current.originalPath,
        resolvedReason: 'original_path',
        downloadError: null,
      },
      warningCodes,
    };
  }

  if (allowDownloadOriginal && current.originalUrl) {
    try {
      const downloadedPath = await downloadOriginalImage(current.originalUrl);
      return {
        sourcePath: downloadedPath,
        imageSource: {
          ...current,
          assetQuality: CreatorImageAssetQuality.Original,
          originalPath: downloadedPath,
          resolvedPath: downloadedPath,
          resolvedReason: 'downloaded_original_url',
          downloadedAt: Date.now(),
          downloadError: null,
        },
        warningCodes,
      };
    } catch (error) {
      warningCodes.push('original_download_failed');
      current.downloadError = error instanceof Error ? error.message : String(error);
    }
  }

  const localPathCandidates = [
    current.localPath,
    current.thumbnailPath,
    resolveBundledCreatorImagePath(current.thumbnailUrl),
    asset.filePath,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const localPath = localPathCandidates.find((candidate) => !candidate.startsWith('creator://') && fs.existsSync(candidate));
  if (localPath) {
    if (current.assetQuality === CreatorImageAssetQuality.Thumbnail) {
      warningCodes.push('using_thumbnail_source');
    } else {
      warningCodes.push('original_unavailable_using_local_asset');
    }
    return {
      sourcePath: localPath,
      imageSource: {
        ...current,
        localPath,
        resolvedPath: localPath,
        resolvedReason: current.assetQuality === CreatorImageAssetQuality.Thumbnail
          ? 'thumbnail_fallback'
          : 'local_fallback',
      },
      warningCodes,
    };
  }

  return {
    sourcePath: asset.filePath,
    imageSource: {
      ...current,
      resolvedPath: asset.filePath,
      resolvedReason: 'missing_local_fallback',
    },
    warningCodes,
  };
};
