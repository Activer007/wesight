import { randomUUID } from 'crypto';

import {
  CreatorImageMetadataStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingOperation,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingPlanSchemaVersion,
  CreatorImageProcessingPlanStatus,
  CreatorImageProcessingRisk,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageProcessingInputItem,
  CreatorImageProcessingOperationStep,
  CreatorImageProcessingOutput,
  CreatorImageProcessingPlan,
  CreatorImageProcessingSource,
  CreatorImageProcessingWarning,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import { ImageProcessingError, ImageProcessingErrorCode } from './imageProcessingErrors';
import {
  CreatorImageProcessingPresetId,
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
  now?: number;
  id?: string;
}

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

const buildWarnings = (
  inputItems: CreatorImageProcessingInputItem[],
  output: CreatorImageProcessingOutput,
): CreatorImageProcessingWarning[] => {
  const warnings: CreatorImageProcessingWarning[] = [];

  for (const item of inputItems) {
    if (item.metadata?.status === CreatorImageMetadataStatus.Missing) {
      warnings.push({
        code: 'source_file_missing',
        severity: CreatorImageProcessingRisk.High,
        messageKey: null,
        details: { inputItemId: item.id },
      });
    }

    if (item.metadata?.hasAlpha && output.format === CreatorImageProcessingOutputFormat.Jpeg) {
      warnings.push({
        code: 'alpha_will_be_removed',
        severity: CreatorImageProcessingRisk.Medium,
        messageKey: null,
        details: { inputItemId: item.id },
      });
    }

    if (item.metadata?.warningCodes.includes('large_pixel_count')) {
      warnings.push({
        code: 'large_pixel_count',
        severity: CreatorImageProcessingRisk.Medium,
        messageKey: null,
        details: { inputItemId: item.id },
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
      format: CreatorImageProcessingOutputFormat.Webp,
      quality: 80,
      outputDirectory: null,
      fileNamePattern: '{name}.processed.{format}',
      overwrite: false,
    });
  const warnings = buildWarnings(input.inputItems, output);
  const now = input.now ?? Date.now();

  return {
    schemaVersion: CreatorImageProcessingPlanSchemaVersion.V1,
    id: input.id ?? randomUUID(),
    projectId,
    source: input.source,
    inputItems: input.inputItems,
    presetId: preset?.id ?? (presetId as CreatorImageProcessingPresetId | null),
    operations,
    output,
    warnings,
    estimatedRisk: estimateRisk(warnings),
    createdBy: input.createdBy ?? CreatorImageProcessingCreatedBy.User,
    status: CreatorImageProcessingPlanStatus.Ready,
    createdAt: now,
    updatedAt: now,
  };
};
