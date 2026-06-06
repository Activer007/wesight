import { randomUUID } from 'crypto';
import path from 'path';

import {
  CreatorImageMetadataStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingOperation,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingPlanSchemaVersion,
  CreatorImageProcessingPlanStatus,
  CreatorImageProcessingPresetId,
  CreatorImageProcessingRisk,
  CreatorImageProcessingSourceKind,
  isCreatorImageProcessingOutputFormat,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageProcessingInputItem,
  CreatorImageProcessingOperationStep,
  CreatorImageProcessingOutput,
  CreatorImageProcessingOutputItem,
  CreatorImageProcessingPlan,
  CreatorImageProcessingSource,
  CreatorImageProcessingWarning,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import type { CreatorProductionAssetRecord } from '../../../shared/creatorStudio/types';
import { ImageProcessingError, ImageProcessingErrorCode } from './imageProcessingErrors';
import {
  getCreatorImageProcessingPreset,
  isCreatorImageProcessingPresetId,
} from './imageProcessingPresets';

export interface CreateImageProcessingPlanInput {
  projectId: string;
  source: CreatorImageProcessingSource;
  inputItems: CreatorImageProcessingInputItem[];
  presetId?: string | null;
  operations?: CreatorImageProcessingOperationStep[];
  output?: CreatorImageProcessingOutput;
  createdBy?: CreatorImageProcessingCreatedBy;
  recipeId?: string | null;
  readmeSuggestions?: CreatorImageProcessingPlan['readmeSuggestions'];
  now?: number;
  id?: string;
}

export interface CreateCreatorAssetImageProcessingPlanInput {
  asset: CreatorProductionAssetRecord;
  presetId?: string | null;
  outputFormat?: CreatorImageProcessingOutputFormat | null;
  quality?: number | null;
  width?: number | null;
  height?: number | null;
  maxWidth?: number | null;
  maxHeight?: number | null;
  cropRatio?: string | null;
  rotate?: number | null;
  outputDirectory?: string | null;
  fileNamePattern?: string | null;
  createdBy?: CreatorImageProcessingCreatedBy;
  recipeId?: string | null;
  readmeSuggestions?: CreatorImageProcessingPlan['readmeSuggestions'];
  now?: number;
  id?: string;
}

export interface CreateCreatorAssetsImageProcessingPlanInput extends Omit<CreateCreatorAssetImageProcessingPlanInput, 'asset'> {
  projectId: string;
  assets: CreatorProductionAssetRecord[];
}

const OutputDirectorySegment = '.wesight/creator-outputs/image-processing';

const clampInteger = (
  value: number | null | undefined,
  min: number,
  max: number,
): number | null => (
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : null
);

const cloneOperationSteps = (
  operations: CreatorImageProcessingOperationStep[],
): CreatorImageProcessingOperationStep[] => operations.map((operation) => ({
  id: operation.id,
  operation: operation.operation,
  params: { ...operation.params },
}));

const cloneOutput = (output: CreatorImageProcessingOutput): CreatorImageProcessingOutput => ({
  format: output.format,
  quality: output.quality,
  outputDirectory: output.outputDirectory,
  fileNamePattern: output.fileNamePattern,
  overwrite: false,
});

const safeBaseName = (filePath: string): string => {
  const parsed = path.parse(filePath);
  return (parsed.name || 'image')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image';
};

const isRiskyOutputDirectory = (outputDirectory: string): boolean => {
  const resolved = path.resolve(outputDirectory);
  const root = path.parse(resolved).root;
  return resolved === root || resolved === path.dirname(root);
};

const resolveOutputDirectory = (
  sourcePath: string,
  planId: string,
  outputDirectory: string | null,
): string => {
  if (outputDirectory?.trim()) {
    return path.resolve(outputDirectory.trim());
  }

  return path.resolve(
    path.dirname(sourcePath),
    OutputDirectorySegment,
    planId,
  );
};

const parseRatio = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : null;
};

const getTargetSize = (
  item: CreatorImageProcessingInputItem,
  operations: CreatorImageProcessingOperationStep[],
): { width: number | null; height: number | null } => {
  let width = item.metadata?.width ?? null;
  let height = item.metadata?.height ?? null;

  for (const step of operations) {
    if (step.operation === CreatorImageProcessingOperation.Resize) {
      const targetWidth = clampInteger(step.params.width as number | null, 1, 20000);
      const targetHeight = clampInteger(step.params.height as number | null, 1, 20000);
      const maxWidth = clampInteger(step.params.maxWidth as number | null, 1, 20000);
      const maxHeight = clampInteger(step.params.maxHeight as number | null, 1, 20000);
      const fit = typeof step.params.fit === 'string' ? step.params.fit : 'inside';

      if (targetWidth && targetHeight && fit === 'cover') {
        width = targetWidth;
        height = targetHeight;
      } else if (targetWidth && targetHeight) {
        width = targetWidth;
        height = targetHeight;
      } else if (width && height && (maxWidth || maxHeight)) {
        const ratio = Math.min(
          maxWidth ? maxWidth / width : Number.POSITIVE_INFINITY,
          maxHeight ? maxHeight / height : Number.POSITIVE_INFINITY,
          step.params.withoutEnlargement === false ? Number.POSITIVE_INFINITY : 1,
        );
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
    }

    if (step.operation === CreatorImageProcessingOperation.Crop) {
      const ratio = parseRatio(step.params.ratio);
      if (ratio && width && height) {
        if (width / height > ratio) {
          width = Math.max(1, Math.round(height * ratio));
        } else {
          height = Math.max(1, Math.round(width / ratio));
        }
      }
    }

    if (step.operation === CreatorImageProcessingOperation.Rotate) {
      const angle = clampInteger(step.params.angle as number | null, -360, 360) ?? 0;
      if (Math.abs(angle) % 180 === 90) {
        [width, height] = [height, width];
      }
    }
  }

  return { width, height };
};

const renderFileName = (
  pattern: string,
  sourcePath: string,
  size: { width: number | null; height: number | null },
  format: CreatorImageProcessingOutputFormat,
): string => {
  const name = safeBaseName(sourcePath);
  const width = size.width ? String(size.width) : 'auto';
  const height = size.height ? String(size.height) : 'auto';
  const fileName = pattern
    .replace(/\{name\}/g, name)
    .replace(/\{width\}/g, width)
    .replace(/\{height\}/g, height)
    .replace(/\{format\}/g, format);
  return fileName.replace(/[\\/]+/g, '-');
};

const buildOutputItems = (
  planId: string,
  inputItems: CreatorImageProcessingInputItem[],
  operations: CreatorImageProcessingOperationStep[],
  output: CreatorImageProcessingOutput,
): CreatorImageProcessingOutputItem[] => inputItems.map((item) => {
  const outputDirectory = resolveOutputDirectory(item.sourcePath, planId, output.outputDirectory);
  const size = getTargetSize(item, operations);
  const fileName = renderFileName(output.fileNamePattern, item.sourcePath, size, output.format);
  return {
    inputItemId: item.id,
    sourceAssetId: item.sourceAssetId,
    outputDirectory,
    fileName,
    outputPath: path.resolve(outputDirectory, fileName),
    width: size.width,
    height: size.height,
    format: output.format,
  };
});

const buildWarnings = (
  inputItems: CreatorImageProcessingInputItem[],
  output: CreatorImageProcessingOutput,
  outputItems: CreatorImageProcessingOutputItem[],
): CreatorImageProcessingWarning[] => {
  const warnings: CreatorImageProcessingWarning[] = [];

  for (const item of inputItems) {
    if (item.metadata?.status === CreatorImageMetadataStatus.Missing) {
      warnings.push({
        code: 'source_file_missing',
        severity: CreatorImageProcessingRisk.High,
        messageKey: 'creatorImageProcessingWarningSourceMissing',
        details: { inputItemId: item.id },
      });
    }

    if (item.metadata?.status === CreatorImageMetadataStatus.Corrupt) {
      warnings.push({
        code: 'source_file_corrupt',
        severity: CreatorImageProcessingRisk.High,
        messageKey: 'creatorImageProcessingWarningSourceCorrupt',
        details: { inputItemId: item.id },
      });
    }

    if (item.metadata?.status === CreatorImageMetadataStatus.Unsupported) {
      warnings.push({
        code: 'unsupported_format',
        severity: CreatorImageProcessingRisk.High,
        messageKey: 'creatorImageProcessingWarningUnsupported',
        details: { inputItemId: item.id },
      });
    }

    if (item.metadata?.hasAlpha && output.format === CreatorImageProcessingOutputFormat.Jpeg) {
      warnings.push({
        code: 'alpha_will_be_removed',
        severity: CreatorImageProcessingRisk.Medium,
        messageKey: 'creatorImageProcessingWarningAlphaToJpeg',
        details: { inputItemId: item.id },
      });
    }

    if (item.metadata?.warningCodes.includes('large_pixel_count')) {
      warnings.push({
        code: 'large_pixel_count',
        severity: CreatorImageProcessingRisk.Medium,
        messageKey: 'creatorImageProcessingWarningLargePixels',
        details: { inputItemId: item.id },
      });
    }

    if (item.metadata?.warningCodes.includes('large_file_size')) {
      warnings.push({
        code: 'large_file_size',
        severity: CreatorImageProcessingRisk.Medium,
        messageKey: 'creatorImageProcessingWarningLargeFile',
        details: { inputItemId: item.id },
      });
    }
  }

  for (const outputItem of outputItems) {
    if (path.resolve(outputItem.outputPath) === path.resolve(
      inputItems.find((item) => item.id === outputItem.inputItemId)?.sourcePath ?? '',
    )) {
      warnings.push({
        code: 'output_matches_source',
        severity: CreatorImageProcessingRisk.High,
        messageKey: 'creatorImageProcessingWarningOutputMatchesSource',
        details: { outputPath: outputItem.outputPath },
      });
    }

    if (isRiskyOutputDirectory(outputItem.outputDirectory)) {
      warnings.push({
        code: 'risky_output_directory',
        severity: CreatorImageProcessingRisk.High,
        messageKey: 'creatorImageProcessingWarningRiskyOutputDirectory',
        details: { outputDirectory: outputItem.outputDirectory },
      });
    }
  }

  return warnings;
};

const estimateRisk = (warnings: CreatorImageProcessingWarning[]): CreatorImageProcessingRisk => {
  if (warnings.some((warning) => warning.severity === CreatorImageProcessingRisk.High)) {
    return CreatorImageProcessingRisk.High;
  }

  if (warnings.some((warning) => warning.severity === CreatorImageProcessingRisk.Medium)) {
    return CreatorImageProcessingRisk.Medium;
  }

  return CreatorImageProcessingRisk.Low;
};

const getFormatFromOperations = (
  operations: CreatorImageProcessingOperationStep[],
): CreatorImageProcessingOutputFormat | null => {
  const convertStep = [...operations].reverse().find((step) => step.operation === CreatorImageProcessingOperation.Convert);
  return isCreatorImageProcessingOutputFormat(convertStep?.params.format)
    ? convertStep.params.format
    : null;
};

const applyOutputOverrides = (
  output: CreatorImageProcessingOutput,
  input: Pick<CreateCreatorAssetImageProcessingPlanInput, 'outputFormat' | 'quality' | 'outputDirectory' | 'fileNamePattern'>,
): CreatorImageProcessingOutput => ({
  ...output,
  ...(input.outputFormat ? { format: input.outputFormat } : {}),
  ...(typeof input.quality === 'number' ? { quality: clampInteger(input.quality, 1, 100) } : {}),
  ...(typeof input.outputDirectory === 'string' && input.outputDirectory.trim()
    ? { outputDirectory: input.outputDirectory.trim() }
    : {}),
  ...(typeof input.fileNamePattern === 'string' && input.fileNamePattern.trim()
    ? { fileNamePattern: input.fileNamePattern.trim() }
    : {}),
  overwrite: false,
});

const buildOperationsFromOverrides = (
  presetOperations: CreatorImageProcessingOperationStep[],
  input: CreateCreatorAssetImageProcessingPlanInput,
): CreatorImageProcessingOperationStep[] => {
  const operations = cloneOperationSteps(presetOperations);

  if (input.cropRatio?.trim()) {
    operations.push({
      id: `crop-${input.cropRatio.trim().replace(/[^\w.-]+/g, '-')}`,
      operation: CreatorImageProcessingOperation.Crop,
      params: { ratio: input.cropRatio.trim(), position: 'centre' },
    });
  }

  const width = clampInteger(input.width, 1, 20000);
  const height = clampInteger(input.height, 1, 20000);
  const maxWidth = clampInteger(input.maxWidth, 1, 20000);
  const maxHeight = clampInteger(input.maxHeight, 1, 20000);
  if (width || height || maxWidth || maxHeight) {
    operations.push({
      id: 'resize-custom',
      operation: CreatorImageProcessingOperation.Resize,
      params: {
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        ...(maxWidth ? { maxWidth } : {}),
        ...(maxHeight ? { maxHeight } : {}),
        fit: width && height ? 'cover' : 'inside',
        withoutEnlargement: true,
      },
    });
  }

  const rotate = clampInteger(input.rotate, -360, 360);
  if (rotate && rotate !== 0) {
    operations.push({
      id: `rotate-${rotate}`,
      operation: CreatorImageProcessingOperation.Rotate,
      params: { angle: rotate },
    });
  }

  if (input.outputFormat || typeof input.quality === 'number') {
    const format = input.outputFormat ?? getFormatFromOperations(operations) ?? CreatorImageProcessingOutputFormat.Webp;
    operations.push({
      id: `convert-${format}`,
      operation: CreatorImageProcessingOperation.Convert,
      params: {
        format,
        quality: clampInteger(input.quality, 1, 100) ?? 80,
      },
    });
  }

  return operations;
};

export const createImageProcessingPlan = (
  input: CreateImageProcessingPlanInput,
): CreatorImageProcessingPlan => {
  const projectId = input.projectId.trim();
  if (!projectId) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.MissingProject,
      'projectId is required',
    );
  }

  if (!input.source) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.MissingSource,
      'source is required',
    );
  }

  if (input.inputItems.length === 0) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.MissingInputItem,
      'at least one input item is required',
    );
  }

  const presetId = input.presetId?.trim() || null;
  const preset = presetId && isCreatorImageProcessingPresetId(presetId)
    ? getCreatorImageProcessingPreset(presetId)
    : null;

  if (presetId && !preset) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.UnknownPreset,
      'image processing preset is not supported',
    );
  }

  const operations = input.operations
    ? cloneOperationSteps(input.operations)
    : cloneOperationSteps(preset?.operationSteps ?? [{
      id: 'auto-orient',
      operation: CreatorImageProcessingOperation.AutoOrient,
      params: {},
    }]);
  const output = input.output
    ? cloneOutput(input.output)
    : cloneOutput(preset?.output ?? {
      format: getFormatFromOperations(operations) ?? CreatorImageProcessingOutputFormat.Webp,
      quality: 80,
      outputDirectory: null,
      fileNamePattern: '{name}.processed.{width}x{height}.{format}',
      overwrite: false,
    });
  const planId = input.id ?? randomUUID();
  const outputItems = buildOutputItems(planId, input.inputItems, operations, output);
  const warnings = buildWarnings(input.inputItems, output, outputItems);
  const now = input.now ?? Date.now();

  return {
    schemaVersion: CreatorImageProcessingPlanSchemaVersion.V1,
    id: planId,
    projectId,
    source: input.source,
    inputItems: input.inputItems,
    presetId: preset?.id ?? null,
    operations,
    output,
    outputItems,
    warnings,
    estimatedRisk: estimateRisk(warnings),
    createdBy: input.createdBy ?? CreatorImageProcessingCreatedBy.User,
    recipeId: input.recipeId ?? input.source.recipeId ?? null,
    readmeSuggestions: input.readmeSuggestions,
    status: CreatorImageProcessingPlanStatus.Ready,
    createdAt: now,
    updatedAt: now,
  };
};

export const createCreatorAssetImageProcessingPlan = (
  input: CreateCreatorAssetImageProcessingPlanInput,
): CreatorImageProcessingPlan => {
  const presetId = input.presetId?.trim() || null;
  const preset = presetId && isCreatorImageProcessingPresetId(presetId)
    ? getCreatorImageProcessingPreset(presetId)
    : null;

  if (presetId && !preset) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.UnknownPreset,
      'image processing preset is not supported',
    );
  }

  const fallbackPreset = preset ?? getCreatorImageProcessingPreset(CreatorImageProcessingPresetId.WebOptimizedWebp);
  if (!fallbackPreset) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.UnknownPreset,
      'default image processing preset is not available',
    );
  }

  const operations = buildOperationsFromOverrides(fallbackPreset.operationSteps, input);
  const output = applyOutputOverrides(fallbackPreset.output, input);
  const source: CreatorImageProcessingSource = {
    sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
    assetId: input.asset.id,
    ...(input.recipeId ? { recipeId: input.recipeId } : {}),
  };

  return createImageProcessingPlan({
    projectId: input.asset.projectId,
    source,
    inputItems: [{
      id: `input-${input.asset.id}`,
      source,
      sourceAssetId: input.asset.id,
      sourcePath: input.asset.filePath,
      metadata: input.asset.imageMetadata,
    }],
    presetId: fallbackPreset.id,
    operations,
    output,
    createdBy: input.createdBy,
    recipeId: input.recipeId,
    readmeSuggestions: input.readmeSuggestions,
    now: input.now,
    id: input.id,
  });
};

export const createCreatorAssetsImageProcessingPlan = (
  input: CreateCreatorAssetsImageProcessingPlanInput,
): CreatorImageProcessingPlan => {
  if (input.assets.length === 0) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.MissingInputItem,
      'at least one image asset is required',
    );
  }

  const presetId = input.presetId?.trim() || null;
  const preset = presetId && isCreatorImageProcessingPresetId(presetId)
    ? getCreatorImageProcessingPreset(presetId)
    : null;

  if (presetId && !preset) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.UnknownPreset,
      'image processing preset is not supported',
    );
  }

  const fallbackPreset = preset ?? getCreatorImageProcessingPreset(CreatorImageProcessingPresetId.WebOptimizedWebp);
  if (!fallbackPreset) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.UnknownPreset,
      'default image processing preset is not available',
    );
  }

  const operations = buildOperationsFromOverrides(fallbackPreset.operationSteps, {
    ...input,
    asset: input.assets[0],
  });
  const output = applyOutputOverrides(fallbackPreset.output, input);
  const source: CreatorImageProcessingSource = {
    sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
    ...(input.recipeId ? { recipeId: input.recipeId } : {}),
  };

  return createImageProcessingPlan({
    projectId: input.projectId,
    source,
    inputItems: input.assets.map((asset) => ({
      id: `input-${asset.id}`,
      source: {
        sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
        assetId: asset.id,
        ...(input.recipeId ? { recipeId: input.recipeId } : {}),
      },
      sourceAssetId: asset.id,
      sourcePath: asset.filePath,
      metadata: asset.imageMetadata,
    })),
    presetId: fallbackPreset.id,
    operations,
    output,
    createdBy: input.createdBy,
    recipeId: input.recipeId,
    readmeSuggestions: input.readmeSuggestions,
    now: input.now,
    id: input.id,
  });
};
