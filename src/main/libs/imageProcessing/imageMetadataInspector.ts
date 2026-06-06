import { stat } from 'fs/promises';
import type { Metadata } from 'sharp';

import {
  CreatorImageMetadataStatus,
  CreatorImageProcessingOutputFormatValues,
} from '../../../shared/creatorStudio/constants';
import type { CreatorImageMetadata } from '../../../shared/creatorStudio/imageProcessingTypes';
import { ImageProcessingErrorCode } from './imageProcessingErrors';

const LargeImagePixelCount = 40_000_000;
const LargeImageFileSize = 100 * 1024 * 1024;

const SupportedInspectionFormats = new Set([
  'avif',
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'webp',
]);

const SharpMimeTypeByFormat: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

const toMimeType = (format: string | undefined): string | null => {
  if (!format) {
    return null;
  }

  return SharpMimeTypeByFormat[format] ?? null;
};

const buildWarnings = (fileSize: number, metadata: Metadata): string[] => {
  const warnings: string[] = [];
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width > 0 && height > 0 && width * height >= LargeImagePixelCount) {
    warnings.push('large_pixel_count');
  }

  if (fileSize >= LargeImageFileSize) {
    warnings.push('large_file_size');
  }

  if (metadata.format && !CreatorImageProcessingOutputFormatValues.includes(
    metadata.format as typeof CreatorImageProcessingOutputFormatValues[number],
  )) {
    warnings.push('format_inspection_only');
  }

  return warnings;
};

export const inspectImageMetadata = async (sourcePath: string): Promise<CreatorImageMetadata> => {
  const inspectedAt = Date.now();

  try {
    const fileStat = await stat(sourcePath);
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(sourcePath, { failOn: 'none' }).metadata();
    const format = metadata.format ?? null;
    const isSupported = format ? SupportedInspectionFormats.has(format) : false;

    return {
      sourcePath,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      fileSize: fileStat.size,
      format,
      mimeType: toMimeType(format ?? undefined),
      hasAlpha: metadata.hasAlpha ?? null,
      exifOrientation: metadata.orientation ?? null,
      colorSpace: metadata.space ?? null,
      inspectedAt,
      status: isSupported
        ? CreatorImageMetadataStatus.Ready
        : CreatorImageMetadataStatus.Unsupported,
      warningCodes: buildWarnings(fileStat.size, metadata),
      ...(!isSupported ? { errorCode: ImageProcessingErrorCode.UnsupportedFormat } : {}),
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    const isMissing = nodeError.code === 'ENOENT';

    return {
      sourcePath,
      width: null,
      height: null,
      fileSize: 0,
      format: null,
      mimeType: null,
      hasAlpha: null,
      exifOrientation: null,
      colorSpace: null,
      inspectedAt,
      status: isMissing
        ? CreatorImageMetadataStatus.Missing
        : CreatorImageMetadataStatus.Corrupt,
      warningCodes: [],
      errorCode: isMissing
        ? ImageProcessingErrorCode.MissingFile
        : ImageProcessingErrorCode.CorruptImage,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
};
