import fs from 'fs';
import { mkdir, rename, unlink } from 'fs/promises';
import path from 'path';
import type { Sharp } from 'sharp';

import {
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingOutputFormatValues,
  CreatorImageQuickEditOperation,
  CreatorImageQuickEditSaveMode,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageMetadata,
  CreatorImageQuickEditParams,
  CreatorImageQuickEditRecord,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import { inspectImageMetadata } from './imageMetadataInspector';
import { ImageProcessingError, ImageProcessingErrorCode } from './imageProcessingErrors';

export interface ImageQuickEditServiceInput extends CreatorImageQuickEditParams {
  sourceAssetId: string;
  sourcePath: string;
  saveMode: CreatorImageQuickEditSaveMode;
  outputPath?: string | null;
  outputDirectory?: string | null;
  now?: number;
}

export interface ImageQuickEditServiceResult {
  outputPath: string;
  fileName: string;
  mimeType: string | null;
  imageMetadata: CreatorImageMetadata;
  quickEdit: CreatorImageQuickEditRecord;
  overwritten: boolean;
}

const EditedSuffix = '-edited';

const normalizeInteger = (
  value: number | null | undefined,
  min: number,
  max: number,
): number | null => (
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : null
);

const normalizeQuality = (value: number | null | undefined): number | null => normalizeInteger(value, 1, 100);

const normalizeRotate = (value: number | null | undefined): number => {
  const angle = normalizeInteger(value, -360, 360) ?? 0;
  return ((angle % 360) + 360) % 360;
};

const parseRatio = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : null;
};

const toMimeType = (format: CreatorImageProcessingOutputFormat): string => {
  switch (format) {
    case CreatorImageProcessingOutputFormat.Avif:
      return 'image/avif';
    case CreatorImageProcessingOutputFormat.Jpeg:
      return 'image/jpeg';
    case CreatorImageProcessingOutputFormat.Png:
      return 'image/png';
    case CreatorImageProcessingOutputFormat.Webp:
    default:
      return 'image/webp';
  }
};

const normalizeSourceFormat = (format: string | null): CreatorImageProcessingOutputFormat => {
  if (format === 'jpg') return CreatorImageProcessingOutputFormat.Jpeg;
  if (CreatorImageProcessingOutputFormatValues.includes(format as CreatorImageProcessingOutputFormat)) {
    return format as CreatorImageProcessingOutputFormat;
  }
  return CreatorImageProcessingOutputFormat.Png;
};

const formatExtension = (format: CreatorImageProcessingOutputFormat): string => (
  format === CreatorImageProcessingOutputFormat.Jpeg ? '.jpg' : `.${format}`
);

const appendSuffix = (filePath: string, suffix: string, extension: string): string => {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${suffix}${extension}`);
};

export const buildUniqueImageQuickEditPath = (basePath: string): string => {
  if (!fs.existsSync(basePath)) return basePath;
  const parsed = path.parse(basePath);
  for (let index = 1; index < 10000; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new ImageProcessingError(ImageProcessingErrorCode.OutputExists, 'could not create a unique output file name');
};

const resolveOutputPath = async (
  input: ImageQuickEditServiceInput,
  outputFormat: CreatorImageProcessingOutputFormat,
): Promise<string> => {
  const sourcePath = path.resolve(input.sourcePath);
  const extension = formatExtension(outputFormat);

  if (input.saveMode === CreatorImageQuickEditSaveMode.Overwrite) {
    return sourcePath;
  }

  if (input.saveMode === CreatorImageQuickEditSaveMode.SaveAs) {
    const outputPath = input.outputPath?.trim();
    if (!outputPath) {
      throw new ImageProcessingError(ImageProcessingErrorCode.MissingSource, 'output path is required');
    }
    return path.resolve(outputPath);
  }

  if (input.saveMode === CreatorImageQuickEditSaveMode.Export) {
    const outputDirectory = input.outputDirectory?.trim();
    if (!outputDirectory) {
      throw new ImageProcessingError(ImageProcessingErrorCode.MissingSource, 'output directory is required');
    }
    const parsed = path.parse(sourcePath);
    const basePath = path.join(path.resolve(outputDirectory), `${parsed.name}${extension}`);
    return buildUniqueImageQuickEditPath(basePath);
  }

  const basePath = appendSuffix(sourcePath, EditedSuffix, extension);
  return buildUniqueImageQuickEditPath(basePath);
};

const applyCropRatio = async (pipeline: Sharp, ratio: number): Promise<Sharp> => {
  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) return pipeline;

  const currentRatio = width / height;
  if (Math.abs(currentRatio - ratio) < 0.01) return pipeline;

  if (currentRatio > ratio) {
    const cropWidth = Math.max(1, Math.round(height * ratio));
    const left = Math.max(0, Math.floor((width - cropWidth) / 2));
    return pipeline.extract({ left, top: 0, width: cropWidth, height });
  }

  const cropHeight = Math.max(1, Math.round(width / ratio));
  const top = Math.max(0, Math.floor((height - cropHeight) / 2));
  return pipeline.extract({ left: 0, top, width, height: cropHeight });
};

const applyResize = (
  pipeline: Sharp,
  input: ImageQuickEditServiceInput,
): Sharp => {
  const width = normalizeInteger(input.width, 1, 20000);
  const height = normalizeInteger(input.height, 1, 20000);
  const longestEdge = normalizeInteger(input.longestEdge, 1, 20000);
  const keepAspect = input.keepAspect !== false;

  if (longestEdge) {
    return pipeline.resize({
      width: longestEdge,
      height: longestEdge,
      fit: 'inside',
      withoutEnlargement: false,
    });
  }

  if (!width && !height) return pipeline;

  return pipeline.resize({
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    fit: keepAspect ? 'inside' : 'fill',
    withoutEnlargement: false,
  });
};

const writePipeline = async (
  pipeline: Sharp,
  outputPath: string,
  outputFormat: CreatorImageProcessingOutputFormat,
  quality: number | null,
): Promise<void> => {
  const normalizedQuality = quality ?? 82;
  const formatted: Sharp = (() : Sharp => {
    switch (outputFormat) {
      case CreatorImageProcessingOutputFormat.Avif:
        return pipeline.avif({ quality: normalizedQuality });
      case CreatorImageProcessingOutputFormat.Jpeg:
        return pipeline.jpeg({ quality: normalizedQuality, mozjpeg: true });
      case CreatorImageProcessingOutputFormat.Png:
        return pipeline.png();
      case CreatorImageProcessingOutputFormat.Webp:
      default:
        return pipeline.webp({ quality: normalizedQuality });
    }
  })();

  await mkdir(path.dirname(outputPath), { recursive: true });
  await formatted.toFile(outputPath);
};

export const createImageQuickEditOperations = (
  input: CreatorImageQuickEditParams,
): CreatorImageQuickEditRecord['operations'] => {
  const operations: CreatorImageQuickEditRecord['operations'] = [];
  const rotate = normalizeRotate(input.rotate);
  const cropRatio = input.cropRatio?.trim();
  const width = normalizeInteger(input.width, 1, 20000);
  const height = normalizeInteger(input.height, 1, 20000);
  const longestEdge = normalizeInteger(input.longestEdge, 1, 20000);
  const outputFormat = input.outputFormat ?? null;
  const quality = normalizeQuality(input.quality);

  if (rotate) {
    operations.push({ operation: CreatorImageQuickEditOperation.Rotate, params: { angle: rotate } });
  }
  if (cropRatio) {
    operations.push({ operation: CreatorImageQuickEditOperation.CropRatio, params: { ratio: cropRatio } });
  }
  if (width || height || longestEdge) {
    operations.push({
      operation: CreatorImageQuickEditOperation.Resize,
      params: {
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        ...(longestEdge ? { longestEdge } : {}),
        keepAspect: input.keepAspect !== false,
      },
    });
  }
  if (outputFormat) {
    operations.push({ operation: CreatorImageQuickEditOperation.Convert, params: { format: outputFormat } });
  }
  if (quality) {
    operations.push({ operation: CreatorImageQuickEditOperation.Compress, params: { quality } });
  }

  return operations;
};

export const executeImageQuickEdit = async (
  input: ImageQuickEditServiceInput,
): Promise<ImageQuickEditServiceResult> => {
  const sourcePath = path.resolve(input.sourcePath);
  if (sourcePath.startsWith('creator://')) {
    throw new ImageProcessingError(ImageProcessingErrorCode.MissingSource, 'quick edit requires a local image file');
  }
  const sourceMetadata = await inspectImageMetadata(sourcePath);
  const outputFormat = input.outputFormat ?? normalizeSourceFormat(sourceMetadata.format);
  const outputPath = await resolveOutputPath(input, outputFormat);
  const overwritten = input.saveMode === CreatorImageQuickEditSaveMode.Overwrite;

  if (!overwritten && input.saveMode !== CreatorImageQuickEditSaveMode.SaveAs && fs.existsSync(outputPath)) {
    throw new ImageProcessingError(ImageProcessingErrorCode.OutputExists, 'output file already exists');
  }

  const sharp = (await import('sharp')).default;
  const rotate = normalizeRotate(input.rotate);
  let pipeline = sharp(sourcePath, { failOn: 'none' }).rotate(rotate || undefined);
  const cropRatio = parseRatio(input.cropRatio);
  if (cropRatio) {
    pipeline = await applyCropRatio(pipeline, cropRatio);
  }
  pipeline = applyResize(pipeline, input);

  if (overwritten) {
    const tempPath = `${outputPath}.wesight-${Date.now()}.tmp`;
    try {
      await writePipeline(pipeline, tempPath, outputFormat, normalizeQuality(input.quality));
      await rename(tempPath, outputPath);
    } catch (error) {
      await unlink(tempPath).catch((): undefined => undefined);
      throw error;
    }
  } else {
    await writePipeline(pipeline, outputPath, outputFormat, normalizeQuality(input.quality));
  }

  const imageMetadata = await inspectImageMetadata(outputPath);
  const now = input.now ?? Date.now();
  const quickEdit: CreatorImageQuickEditRecord = {
    schemaVersion: 'creator.imageQuickEdit.v1',
    sourceAssetId: input.sourceAssetId,
    saveMode: input.saveMode,
    operations: createImageQuickEditOperations(input),
    outputPath,
    overwritten,
    createdAt: now,
  };

  return {
    outputPath,
    fileName: path.basename(outputPath),
    mimeType: imageMetadata.mimeType ?? toMimeType(outputFormat),
    imageMetadata,
    quickEdit,
    overwritten,
  };
};
