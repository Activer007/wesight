import {
  CreatorImageProcessingOperation,
  CreatorImageProcessingOutputFormat,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageProcessingOperationStep,
  CreatorImageProcessingOutput,
} from '../../../shared/creatorStudio/imageProcessingTypes';

export const CreatorImageProcessingPresetId = {
  WebOptimizedWebp: 'web-optimized-webp',
  ReadmeBanner: 'readme-banner',
  SocialCard1200x675: 'social-card-1200x675',
} as const;

export type CreatorImageProcessingPresetId =
  typeof CreatorImageProcessingPresetId[keyof typeof CreatorImageProcessingPresetId];

export const CreatorImageProcessingPresetIdValues = [
  CreatorImageProcessingPresetId.WebOptimizedWebp,
  CreatorImageProcessingPresetId.ReadmeBanner,
  CreatorImageProcessingPresetId.SocialCard1200x675,
] as const;

export interface CreatorImageProcessingPreset {
  id: CreatorImageProcessingPresetId;
  operationSteps: CreatorImageProcessingOperationStep[];
  output: CreatorImageProcessingOutput;
}

const createOutput = (
  format: CreatorImageProcessingOutputFormat,
  quality: number | null,
  fileNamePattern: string,
): CreatorImageProcessingOutput => ({
  format,
  quality,
  outputDirectory: null,
  fileNamePattern,
  overwrite: false,
});

export const CreatorImageProcessingPresets: CreatorImageProcessingPreset[] = [
  {
    id: CreatorImageProcessingPresetId.WebOptimizedWebp,
    operationSteps: [
      {
        id: 'auto-orient',
        operation: CreatorImageProcessingOperation.AutoOrient,
        params: {},
      },
      {
        id: 'resize-long-edge-1600',
        operation: CreatorImageProcessingOperation.Resize,
        params: {
          fit: 'inside',
          withoutEnlargement: true,
          maxWidth: 1600,
          maxHeight: 1600,
        },
      },
      {
        id: 'convert-webp',
        operation: CreatorImageProcessingOperation.Convert,
        params: {
          format: CreatorImageProcessingOutputFormat.Webp,
          quality: 80,
        },
      },
    ],
    output: createOutput(
      CreatorImageProcessingOutputFormat.Webp,
      80,
      '{name}.web-optimized.{width}w.{format}',
    ),
  },
  {
    id: CreatorImageProcessingPresetId.ReadmeBanner,
    operationSteps: [
      {
        id: 'auto-orient',
        operation: CreatorImageProcessingOperation.AutoOrient,
        params: {},
      },
      {
        id: 'resize-readme-banner',
        operation: CreatorImageProcessingOperation.Resize,
        params: {
          width: 1600,
          height: 800,
          fit: 'cover',
        },
      },
      {
        id: 'convert-webp',
        operation: CreatorImageProcessingOperation.Convert,
        params: {
          format: CreatorImageProcessingOutputFormat.Webp,
          quality: 82,
        },
      },
    ],
    output: createOutput(
      CreatorImageProcessingOutputFormat.Webp,
      82,
      '{name}.readme-banner.1600x800.{format}',
    ),
  },
  {
    id: CreatorImageProcessingPresetId.SocialCard1200x675,
    operationSteps: [
      {
        id: 'auto-orient',
        operation: CreatorImageProcessingOperation.AutoOrient,
        params: {},
      },
      {
        id: 'resize-social-card',
        operation: CreatorImageProcessingOperation.Resize,
        params: {
          width: 1200,
          height: 675,
          fit: 'cover',
        },
      },
      {
        id: 'convert-webp',
        operation: CreatorImageProcessingOperation.Convert,
        params: {
          format: CreatorImageProcessingOutputFormat.Webp,
          quality: 84,
        },
      },
    ],
    output: createOutput(
      CreatorImageProcessingOutputFormat.Webp,
      84,
      '{name}.social-card.1200x675.{format}',
    ),
  },
];

export const isCreatorImageProcessingPresetId = (
  value: unknown,
): value is CreatorImageProcessingPresetId => (
  typeof value === 'string'
  && CreatorImageProcessingPresetIdValues.includes(value as CreatorImageProcessingPresetId)
);

export const getCreatorImageProcessingPreset = (
  presetId: CreatorImageProcessingPresetId,
): CreatorImageProcessingPreset | null => (
  CreatorImageProcessingPresets.find((preset) => preset.id === presetId) ?? null
);
