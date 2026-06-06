import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import {
  CreatorAssetAdoptionStatus,
  CreatorAssetSelectionStatus,
  CreatorBatchRunStatus,
  CreatorBatchTaskStatus,
  CreatorBoardCardKind,
  CreatorBoardMoveDirection,
  CreatorImageAssetQuality,
  CreatorImageMetadataStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingPlanStatus,
  CreatorImageProcessingSourceKind,
  CreatorImageProcessingTaskStatus,
  CreatorProductionAssetKind,
  CreatorProductionAssetSource,
  CreatorProductionAssetStatus,
  CreatorProductionRunSource,
  CreatorProductionRunStatus,
  CreatorPromptSpecSchemaVersion,
  CreatorRecipeImageProcessingPackKind,
  CreatorRecipeOutputKind,
  CreatorRecipeOutputSchemaVersion,
  CreatorStudioDefaultProjectId,
  isCreatorImageMetadataStatus,
  isCreatorImageProcessingJobStatus,
  isCreatorImageProcessingOutputFormat,
  isCreatorImageProcessingPlanStatus,
  isCreatorImageProcessingPresetId,
  isCreatorImageProcessingTaskStatus,
  isCreatorRecipeImageProcessingPackKind,
  isCreatorRecipeOutputKind,
  isCreatorRecipeOutputSchemaVersion,
} from '../shared/creatorStudio/constants';
import type {
  CreatorImageBatchCreateInput,
  CreatorImageBatchCreateResult,
  CreatorImageJobListInput,
  CreatorImageJobListResult,
  CreatorImageMetadata,
  CreatorImageProcessingJob,
  CreatorImageProcessingPlan,
  CreatorImageProcessingReport,
  CreatorImageProcessingRuntimeMetrics,
  CreatorImageProcessingTask,
  CreatorImageTaskCancelResult,
  CreatorImageTaskRetryResult,
} from '../shared/creatorStudio/imageProcessingTypes';
import { CREATOR_CREATIVE_MODEL_CAPABILITIES } from '../shared/creatorStudio/modelCapabilities';
import type {
  CreatorAssetCollectionAddInput,
  CreatorAssetCollectionCreateInput,
  CreatorAssetCollectionRecord,
  CreatorAssetUpdateInput,
  CreatorBatchDirectionInput,
  CreatorBatchRunCreateInput,
  CreatorBatchRunListInput,
  CreatorBatchRunListResult,
  CreatorBatchRunRecord,
  CreatorBatchRunSummary,
  CreatorBatchTaskFailInput,
  CreatorBatchTaskRecord,
  CreatorBoardCardCreateInput,
  CreatorBoardCardMoveInput,
  CreatorBoardCardRecord,
  CreatorBoardCardSelectInput,
  CreatorBoardCardUpdateInput,
  CreatorBoardContextPackInput,
  CreatorBoardContextPackResult,
  CreatorBoardCreateInput,
  CreatorBoardDirectionSnapshot,
  CreatorBoardRecord,
  CreatorBoardWorkspaceSnapshot,
  CreatorBrandKitRecord,
  CreatorBrandKitUpdateInput,
  CreatorCaseAssetCreateInput,
  CreatorImageInspectInput,
  CreatorImageInspectResult,
  CreatorImageProcessingAssetCreateInput,
  CreatorImageProcessingAssetMetadata,
  CreatorProductionAssetListInput,
  CreatorProductionAssetListResult,
  CreatorProductionAssetRecord,
  CreatorProductionAssetSourceLookup,
  CreatorProductionRunRecord,
  CreatorProjectCreateInput,
  CreatorPromptAssetCreateInput,
  CreatorPromptSpecBriefV1,
  CreatorPromptSpecSnapshot,
  CreatorPromptVersionCreateInput,
  CreatorPromptVersionDiffInput,
  CreatorPromptVersionDiffResult,
  CreatorPromptVersionForkInput,
  CreatorPromptVersionListInput,
  CreatorPromptVersionListResult,
  CreatorPromptVersionRecord,
  CreatorRecipeCreateInput,
  CreatorRecipeImageProcessingOutput,
  CreatorRecipeImageProcessingRule,
  CreatorRecipeImportInput,
  CreatorRecipeListInput,
  CreatorRecipeListResult,
  CreatorRecipeRecord,
  CreatorStudioSourceContext,
  CreatorWorkspaceSnapshot,
} from '../shared/creatorStudio/types';
import type { CoworkMessage, CoworkMessageMetadata } from './coworkStore';
import { inspectImageMetadata } from './libs/imageProcessing/imageMetadataInspector';
import { createCreatorAssetsImageProcessingPlan } from './libs/imageProcessing/imageProcessingPlanner';
import { createImageProcessingReport } from './libs/imageProcessing/imageProcessingReport';
import { executeImageProcessingTask } from './libs/imageProcessing/imageProcessingService';
import {
  buildCreatorImageSourceFile,
  parseCreatorImageSourceFile,
  resolveCreatorImageSourceForProcessing,
} from './libs/imageProcessing/imageSourceResolver';

interface ProductionAssetRow {
  id: string;
  project_id: string | null;
  kind: string;
  title: string | null;
  status: string;
  source: string;
  run_id: string | null;
  source_run_id: string | null;
  variant_of_asset_id: string | null;
  session_id: string | null;
  source_session_id: string | null;
  message_id: string | null;
  source_message_id: string | null;
  template_id: string | null;
  case_ids: string;
  case_ids_json: string | null;
  prompt_spec: string | null;
  prompt_spec_json: string | null;
  prompt_text: string;
  parent_prompt_asset_id: string | null;
  prompt_version_id: string | null;
  recipe_id: string | null;
  selected_direction_id: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  favorite: number;
  adoption_status: string | null;
  tags_json: string | null;
  license_note: string | null;
  usage_note: string | null;
  metadata: string | null;
  created_at: number;
  updated_at: number;
  source_session_available?: number | null;
  collection_ids_json?: string | null;
  selected_status?: string | null;
}

export interface CreatorImageProcessingRecipeExecuteInput {
  recipeId: string;
  assetId: string;
  ruleId?: string | null;
  outputDirectory?: string | null;
  waitForCompletion?: boolean;
}

interface ProductionRunRow {
  id: string;
  source: string;
  status: string;
  session_id: string | null;
  template_id: string | null;
  variant_of_asset_id: string | null;
  prompt_version_id: string | null;
  recipe_id: string | null;
  selected_direction_id: string | null;
  case_ids: string;
  prompt_spec: string | null;
  prompt_text: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

interface ImageProcessingPlanRow {
  id: string;
  project_id: string;
  source_json: string;
  plan_json: string;
  status: string;
  preset_id: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

interface ImageProcessingJobRow {
  id: string;
  project_id: string;
  plan_id: string;
  status: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  input_total_size: number;
  output_total_size: number;
  saved_size: number;
  report_asset_id: string | null;
  metadata_json: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
}

interface ImageProcessingTaskRow {
  id: string;
  job_id: string;
  project_id: string;
  source_asset_id: string | null;
  output_asset_id: string | null;
  source_artifact_id: string | null;
  source_path: string;
  output_path: string | null;
  status: string;
  input_size: number | null;
  output_size: number | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

type GeneratedImageInput = {
  path: string;
  name?: string;
  mimeType?: string;
  source?: string;
  assetQuality?: string;
  originalPath?: string;
  thumbnailPath?: string;
  originalUrl?: string;
  thumbnailUrl?: string;
};

interface CreatorGeneratedImageContext {
  templateId: string | null;
  caseIds: string[];
  promptSpec: CreatorPromptSpecSnapshot | null;
  promptText: string;
  variantOfAssetId: string | null;
  promptVersionId: string | null;
  recipeId: string | null;
  selectedDirectionId: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

interface CollectionRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  asset_count: number;
}

interface BoardRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

interface BoardCardRow {
  id: string;
  board_id: string;
  project_id: string;
  kind: string;
  title: string;
  asset_id: string | null;
  case_id: string | null;
  prompt_text: string;
  prompt_spec_json: string | null;
  direction_json: string | null;
  group_name: string | null;
  notes: string | null;
  position: number;
  created_at: number;
  updated_at: number;
  selected?: number | null;
}

interface BrandKitRow {
  project_id: string;
  colors_json: string | null;
  logo_asset_id: string | null;
  logo_path: string | null;
  banned_words_json: string | null;
  tone: string | null;
  visual_preferences: string | null;
  created_at: number;
  updated_at: number;
}

interface BatchRunRow {
  id: string;
  project_id: string;
  status: string;
  brief_title: string;
  prompt_spec_json: string;
  prompt_text: string;
  summary_json: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

interface BatchTaskRow {
  id: string;
  batch_run_id: string;
  project_id: string;
  status: string;
  direction_id: string;
  direction_title: string;
  model_id: string;
  model_name: string;
  template_id: string;
  size: string;
  prompt_spec_json: string;
  prompt_text: string;
  asset_ids_json: string | null;
  error: string | null;
  cost_estimate_text: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

interface RecipeRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  source_prompt_asset_id: string | null;
  prompt_spec_json: string;
  default_runtime_json: string | null;
  default_output_json: string | null;
  tags_json: string | null;
  created_at: number;
  updated_at: number;
}

interface PromptVersionRow {
  id: string;
  prompt_asset_id: string;
  version: number;
  prompt_text: string;
  prompt_spec_json: string;
  change_note: string | null;
  created_at: number;
}

const CREATOR_STUDIO_MARKER = '[Creator Studio]';
const CreatorWorkspaceStateKey = {
  CurrentProjectId: 'current_project_id',
  CurrentBoardIdPrefix: 'current_board_id',
} as const;

const parseJsonArray = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
};

const parseJsonObject = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const optionalNumber = (value: unknown): number | null | undefined => (
  value === null || value === undefined
    ? value as null | undefined
    : typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined
);

const optionalString = (value: unknown): string | null | undefined => (
  value === null || value === undefined
    ? value as null | undefined
    : typeof value === 'string'
      ? value
      : undefined
);

export const parseCreatorRecipeImageProcessingOutput = (
  defaultOutput: unknown,
): CreatorRecipeImageProcessingOutput | null => {
  if (!isRecord(defaultOutput)) return null;
  const candidate = isRecord(defaultOutput.imageProcessing)
    ? defaultOutput.imageProcessing
    : defaultOutput;
  if (
    !isCreatorRecipeOutputSchemaVersion(candidate.schemaVersion)
    || !isCreatorRecipeOutputKind(candidate.kind)
    || candidate.kind !== CreatorRecipeOutputKind.ImageProcessing
    || !isCreatorRecipeImageProcessingPackKind(candidate.packKind)
    || !Array.isArray(candidate.rules)
  ) {
    return null;
  }

  const rules: CreatorRecipeImageProcessingRule[] = candidate.rules
    .filter(isRecord)
    .map((rule): CreatorRecipeImageProcessingRule | null => {
      const id = typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim() : null;
      const title = typeof rule.title === 'string' && rule.title.trim() ? rule.title.trim() : null;
      const presetId = isCreatorImageProcessingPresetId(rule.presetId) ? rule.presetId : null;
      if (!id || !title || !presetId) return null;
      const readmeSuggestion = isRecord(rule.readmeSuggestion)
        ? {
          outputRelativePath: typeof rule.readmeSuggestion.outputRelativePath === 'string'
            ? rule.readmeSuggestion.outputRelativePath
            : '',
          markdown: typeof rule.readmeSuggestion.markdown === 'string'
            ? rule.readmeSuggestion.markdown
            : '',
          note: typeof rule.readmeSuggestion.note === 'string' ? rule.readmeSuggestion.note : null,
        }
        : null;
      const parsedRule: CreatorRecipeImageProcessingRule = {
        id,
        title,
        presetId,
      };
      if (isCreatorImageProcessingOutputFormat(rule.outputFormat)) parsedRule.outputFormat = rule.outputFormat;
      if (optionalString(rule.outputFormat) === null) parsedRule.outputFormat = null;
      const quality = optionalNumber(rule.quality);
      if (quality !== undefined) parsedRule.quality = quality;
      const width = optionalNumber(rule.width);
      if (width !== undefined) parsedRule.width = width;
      const height = optionalNumber(rule.height);
      if (height !== undefined) parsedRule.height = height;
      const maxWidth = optionalNumber(rule.maxWidth);
      if (maxWidth !== undefined) parsedRule.maxWidth = maxWidth;
      const maxHeight = optionalNumber(rule.maxHeight);
      if (maxHeight !== undefined) parsedRule.maxHeight = maxHeight;
      const cropRatio = optionalString(rule.cropRatio);
      if (cropRatio !== undefined) parsedRule.cropRatio = cropRatio;
      const rotate = optionalNumber(rule.rotate);
      if (rotate !== undefined) parsedRule.rotate = rotate;
      const outputDirectory = optionalString(rule.outputDirectory);
      if (outputDirectory !== undefined) parsedRule.outputDirectory = outputDirectory;
      const fileNamePattern = optionalString(rule.fileNamePattern);
      if (fileNamePattern !== undefined) parsedRule.fileNamePattern = fileNamePattern;
      if (readmeSuggestion) parsedRule.readmeSuggestion = readmeSuggestion;
      return parsedRule;
    })
    .filter((rule): rule is CreatorRecipeImageProcessingRule => Boolean(rule));

  if (rules.length === 0) return null;

  return {
    schemaVersion: CreatorRecipeOutputSchemaVersion.ImageProcessingV1,
    kind: CreatorRecipeOutputKind.ImageProcessing,
    packKind: candidate.packKind,
    rules,
    report: isRecord(candidate.report)
      ? { enabled: candidate.report.enabled !== false }
      : { enabled: true },
    readmeSuggestion: isRecord(candidate.readmeSuggestion)
      ? {
        enabled: candidate.readmeSuggestion.enabled !== false,
        note: typeof candidate.readmeSuggestion.note === 'string' ? candidate.readmeSuggestion.note : null,
      }
      : null,
  };
};

const parseImageProcessingPlanJson = (value: string): CreatorImageProcessingPlan | null => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as CreatorImageProcessingPlan
      : null;
  } catch {
    return null;
  }
};

const parseImageMetadata = (metadata: Record<string, unknown>): CreatorImageMetadata | null => {
  const value = metadata.imageMetadata;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sourcePath = typeof record.sourcePath === 'string' ? record.sourcePath : null;
  const fileSize = typeof record.fileSize === 'number' ? record.fileSize : null;
  const inspectedAt = typeof record.inspectedAt === 'number' ? record.inspectedAt : null;
  if (!sourcePath || fileSize === null || inspectedAt === null || !isCreatorImageMetadataStatus(record.status)) {
    return null;
  }

  return {
    sourcePath,
    width: typeof record.width === 'number' ? record.width : null,
    height: typeof record.height === 'number' ? record.height : null,
    fileSize,
    format: typeof record.format === 'string' ? record.format : null,
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
    hasAlpha: typeof record.hasAlpha === 'boolean' ? record.hasAlpha : null,
    exifOrientation: typeof record.exifOrientation === 'number' ? record.exifOrientation : null,
    colorSpace: typeof record.colorSpace === 'string' ? record.colorSpace : null,
    inspectedAt,
    status: record.status,
    warningCodes: Array.isArray(record.warningCodes)
      ? record.warningCodes.filter((item): item is string => typeof item === 'string')
      : [],
    ...(typeof record.errorCode === 'string' ? { errorCode: record.errorCode } : {}),
    ...(typeof record.errorMessage === 'string' ? { errorMessage: record.errorMessage } : {}),
  };
};

const getGeneratedImageSourceMetadata = (image: GeneratedImageInput): Record<string, unknown> => {
  const imageSource = buildCreatorImageSourceFile({
    localPath: image.path,
    assetQuality: image.assetQuality === CreatorImageAssetQuality.Original
      ? CreatorImageAssetQuality.Original
      : image.assetQuality === CreatorImageAssetQuality.Thumbnail
        ? CreatorImageAssetQuality.Thumbnail
        : CreatorImageAssetQuality.Unknown,
    originalPath: image.originalPath ?? null,
    thumbnailPath: image.thumbnailPath ?? null,
    originalUrl: image.originalUrl ?? null,
    thumbnailUrl: image.thumbnailUrl ?? null,
    provider: image.source ?? null,
  });
  return {
    generatedImageSource: image.source || null,
    imageSource,
  };
};

const parseImageProcessingMetadata = (metadata: Record<string, unknown>): CreatorImageProcessingAssetMetadata | null => {
  const value = metadata.processing;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sourceAssetId = typeof record.sourceAssetId === 'string' && record.sourceAssetId.trim()
    ? record.sourceAssetId.trim()
    : null;
  if (!sourceAssetId) return null;

  const plan = record.plan && typeof record.plan === 'object' && !Array.isArray(record.plan)
    ? record.plan as CreatorImageProcessingAssetMetadata['plan']
    : null;
  const job = record.job && typeof record.job === 'object' && !Array.isArray(record.job)
    ? record.job as CreatorImageProcessingAssetMetadata['job']
    : null;
  const task = record.task && typeof record.task === 'object' && !Array.isArray(record.task)
    ? record.task as CreatorImageProcessingAssetMetadata['task']
    : null;
  const tasks = Array.isArray(record.tasks)
    ? record.tasks.filter((item): item is CreatorImageProcessingTask => (
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    ))
    : undefined;
  const report = record.report && typeof record.report === 'object' && !Array.isArray(record.report)
    ? record.report as CreatorImageProcessingAssetMetadata['report']
    : null;
  const readmeSuggestions = Array.isArray(record.readmeSuggestions)
    ? record.readmeSuggestions as CreatorImageProcessingAssetMetadata['readmeSuggestions']
    : undefined;
  const planOperations = plan?.operations ?? [];
  const operations = Array.isArray(record.operations)
    ? record.operations as CreatorImageProcessingAssetMetadata['operations']
    : planOperations;

  return {
    sourceAssetId,
    recipeId: typeof record.recipeId === 'string' ? record.recipeId : plan?.recipeId ?? null,
    presetId: typeof record.presetId === 'string' ? record.presetId : plan?.presetId ?? null,
    operations,
    plan,
    job,
    task,
    tasks,
    report,
    readmeSuggestions,
  };
};

const parseImageProcessingRuntimeMetrics = (
  value: unknown,
): CreatorImageProcessingRuntimeMetrics | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<CreatorImageProcessingRuntimeMetrics>;
  if (record.backend !== 'sharp') return null;
  return {
    backend: 'sharp',
    source: typeof record.source === 'string' ? record.source as CreatorImageProcessingRuntimeMetrics['source'] : CreatorImageProcessingSourceKind.CreatorAsset,
    preset: typeof record.preset === 'string' ? record.preset as CreatorImageProcessingRuntimeMetrics['preset'] : null,
    durationMs: typeof record.durationMs === 'number' ? record.durationMs : 0,
    imageCount: typeof record.imageCount === 'number' ? record.imageCount : 0,
    successCount: typeof record.successCount === 'number' ? record.successCount : 0,
    failedCount: typeof record.failedCount === 'number' ? record.failedCount : 0,
    inputSize: typeof record.inputSize === 'number' ? record.inputSize : 0,
    outputSize: typeof record.outputSize === 'number' ? record.outputSize : 0,
    savedSize: typeof record.savedSize === 'number' ? record.savedSize : 0,
    savedPercentage: typeof record.savedPercentage === 'number' ? record.savedPercentage : 0,
  };
};

const normalizeTags = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const tag = value.trim();
    if (!tag) continue;
    unique.add(tag.slice(0, 48));
  }
  return [...unique].slice(0, 24);
};

const normalizeOptionalText = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 1000) : null
);

const isAdoptionStatus = (value: unknown): value is CreatorAssetAdoptionStatus => (
  typeof value === 'string'
  && Object.values(CreatorAssetAdoptionStatus).includes(value as CreatorAssetAdoptionStatus)
);

const parsePromptSpec = (value: string | null | undefined): CreatorPromptSpecSnapshot | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object'
      ? parsed as CreatorPromptSpecSnapshot
      : null;
  } catch {
    return null;
  }
};

const normalizePromptSpecCaseIds = (spec: CreatorPromptSpecSnapshot): string[] => (
  Array.isArray(spec.caseIds)
    ? spec.caseIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
);

const normalizePromptSpecStringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
);

const ensurePromptSpecV1Snapshot = (
  input: CreatorPromptSpecSnapshot,
  fallbackTitle: string
): CreatorPromptSpecSnapshot => {
  const constraints = input.constraints && typeof input.constraints === 'object' && !Array.isArray(input.constraints)
    ? input.constraints
    : {};
  const caseIds = normalizePromptSpecCaseIds(input);
  const language = input.language === 'en' ? 'en' : 'zh';
  const sourceMode = typeof input.sourceMode === 'string' && input.sourceMode.trim()
    ? input.sourceMode
    : typeof input.source?.mode === 'string' && input.source.mode.trim()
      ? input.source.mode
      : 'blank';
  const sourceType = typeof input.sourceType === 'string' && input.sourceType.trim()
    ? input.sourceType
    : typeof input.source?.sourceType === 'string' && input.source.sourceType.trim()
      ? input.source.sourceType
      : 'template';
  const sourceId = typeof input.sourceId === 'string' && input.sourceId.trim()
    ? input.sourceId
    : typeof input.source?.sourceId === 'string' && input.source.sourceId.trim()
      ? input.source.sourceId
      : '';
  const sourceTitle = typeof input.sourceTitle === 'string' && input.sourceTitle.trim()
    ? input.sourceTitle
    : typeof input.source?.sourceTitle === 'string' && input.source.sourceTitle.trim()
      ? input.source.sourceTitle
      : fallbackTitle;
  const templateId = typeof input.templateId === 'string' && input.templateId.trim()
    ? input.templateId
    : typeof input.source?.templateId === 'string' && input.source.templateId.trim()
      ? input.source.templateId
      : null;
  const aspectRatio = typeof constraints.aspectRatio === 'string' ? constraints.aspectRatio : '';
  const requiredText = typeof constraints.requiredText === 'string' ? constraints.requiredText : '';
  const negativeRequirements = typeof constraints.negativeRequirements === 'string' ? constraints.negativeRequirements : '';
  const templateFields = Array.isArray(input.templateFields)
    ? input.templateFields
    : [];
  const sourceDefaults = {
    mode: sourceMode,
    sourceType,
    sourceId,
    sourceTitle,
    templateId,
    caseIds,
    variantOfAssetId: typeof input.variantOfAssetId === 'string' ? input.variantOfAssetId : null,
    referencePrompt: typeof input.referencePrompt === 'string' ? input.referencePrompt : null,
    referenceAnalysis: input.referenceAnalysis,
  };
  const briefDefaults: CreatorPromptSpecBriefV1 = {
    taskType: typeof input.taskType === 'string' ? input.taskType : '',
    subject: typeof input.subject === 'string' ? input.subject : '',
    goal: typeof input.subject === 'string' && input.subject.trim() ? input.subject : sourceTitle,
    platform: typeof input.platform === 'string' ? input.platform : '',
    audience: typeof input.audience === 'string' ? input.audience : '',
    language,
  };
  const compositionDefaults = {
    aspectRatio,
    mainObject: typeof input.mainObject === 'string' ? input.mainObject : '',
  };
  const styleDefaults = {
    visualStyle: typeof input.visualStyle === 'string' ? input.visualStyle : '',
    styles: normalizePromptSpecStringArray(input.styles),
    scenes: normalizePromptSpecStringArray(input.scenes),
    colorPreference: typeof input.colorPreference === 'string' ? input.colorPreference : '',
  };
  const textDefaults = {
    requiredText,
    negativeRequirements,
  };
  const outputDefaults = {
    count: typeof input.outputCount === 'string' ? input.outputCount : '',
  };
  const templateDefaults = {
    templateId,
    fields: templateFields,
  };
  const provenanceDefaults = {
    templateId,
    caseIds,
    variantOfAssetId: typeof input.variantOfAssetId === 'string' ? input.variantOfAssetId : null,
  };

  return {
    ...input,
    schemaVersion: CreatorPromptSpecSchemaVersion.V1,
    source: { ...sourceDefaults, ...(input.source ?? {}) },
    brief: { ...briefDefaults, ...(input.brief ?? {}) },
    composition: { ...compositionDefaults, ...(input.composition ?? {}) },
    style: { ...styleDefaults, ...(input.style ?? {}) },
    text: { ...textDefaults, ...(input.text ?? {}) },
    output: { ...outputDefaults, ...(input.output ?? {}) },
    template: { ...templateDefaults, ...(input.template ?? {}) },
    provenance: { ...provenanceDefaults, ...(input.provenance ?? {}) },
  };
};

const parseBatchSummary = (value: string | null | undefined): CreatorBatchRunSummary => {
  if (!value) {
    return {
      taskCount: 0,
      modelIds: [],
      modelNames: [],
      templateIds: [],
      sizes: [],
      estimatedCostUnits: 0,
      costUnitLabel: 'task',
    };
  }
  try {
    const parsed = JSON.parse(value) as Partial<CreatorBatchRunSummary> | null;
    return {
      taskCount: typeof parsed?.taskCount === 'number' ? parsed.taskCount : 0,
      modelIds: Array.isArray(parsed?.modelIds) ? parsed.modelIds.filter((item): item is string => typeof item === 'string') : [],
      modelNames: Array.isArray(parsed?.modelNames) ? parsed.modelNames.filter((item): item is string => typeof item === 'string') : [],
      templateIds: Array.isArray(parsed?.templateIds) ? parsed.templateIds.filter((item): item is string => typeof item === 'string') : [],
      sizes: Array.isArray(parsed?.sizes) ? parsed.sizes.filter((item): item is string => typeof item === 'string') : [],
      estimatedCostUnits: typeof parsed?.estimatedCostUnits === 'number' ? parsed.estimatedCostUnits : 0,
      costUnitLabel: typeof parsed?.costUnitLabel === 'string' ? parsed.costUnitLabel : 'task',
    };
  } catch {
    return {
      taskCount: 0,
      modelIds: [],
      modelNames: [],
      templateIds: [],
      sizes: [],
      estimatedCostUnits: 0,
      costUnitLabel: 'task',
    };
  }
};

const parseDirection = (value: string | null | undefined): CreatorBoardDirectionSnapshot | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CreatorBoardDirectionSnapshot> | null;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.title !== 'string') return null;
    return {
      id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id : parsed.title,
      title: parsed.title,
      template: typeof parsed.template === 'string' ? parsed.template : '',
      style: typeof parsed.style === 'string' ? parsed.style : '',
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      promptFocus: typeof parsed.promptFocus === 'string' ? parsed.promptFocus : '',
    };
  } catch {
    return null;
  }
};

const firstNonEmptyString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const getPromptSpecBatchString = (promptSpec: CreatorPromptSpecSnapshot | null, key: string): string | null => {
  const batch = promptSpec?.batch;
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) return null;
  const value = (batch as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const parseLineList = (text: string, key: string): string[] => {
  const pattern = new RegExp(`${key}\\s*[:：]\\s*([^\\n]+)`, 'i');
  const match = text.match(pattern);
  if (!match?.[1]) return [];
  const raw = match[1].trim();
  if (!raw || raw.toLowerCase() === 'none') return [];
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
};

export const parseCreatorStudioSourceContext = (text: string): CreatorStudioSourceContext | null => {
  if (!text.includes(CREATOR_STUDIO_MARKER)) {
    return null;
  }

  const promptSpecMatch = text.match(/PromptSpec:\s*```json\s*([\s\S]*?)```/i);
  const promptTextMatch = text.match(/Prompt:\s*```(?:text)?\s*([\s\S]*?)```/i);
  const promptSpec = parsePromptSpec(promptSpecMatch?.[1] ?? null);
  const templateId = firstNonEmptyString(
    promptSpec?.templateId,
    text.match(/templateId\s*[:：]\s*([^\n]+)/i)?.[1]?.replace(/^none$/i, '')
  );
  const caseIds = promptSpec?.caseIds && Array.isArray(promptSpec.caseIds)
    ? promptSpec.caseIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : parseLineList(text, 'caseIds');

  return {
    templateId,
    caseIds,
    promptSpec,
    promptText: promptTextMatch?.[1]?.trim() || '',
    sourceTitle: firstNonEmptyString(promptSpec?.sourceTitle),
    variantOfAssetId: firstNonEmptyString(promptSpec?.variantOfAssetId),
    promptVersionId: firstNonEmptyString(
      typeof promptSpec?.promptVersionId === 'string' ? promptSpec.promptVersionId : null,
      text.match(/promptVersionId\s*[:：]\s*([^\n]+)/i)?.[1]
    ),
    recipeId: firstNonEmptyString(
      typeof promptSpec?.recipeId === 'string' ? promptSpec.recipeId : null,
      text.match(/recipeId\s*[:：]\s*([^\n]+)/i)?.[1]
    ),
    selectedDirectionId: firstNonEmptyString(
      promptSpec?.selectedCreativeDirectionId,
      typeof promptSpec?.selectedDirectionId === 'string' ? promptSpec.selectedDirectionId : null,
      text.match(/selectedDirectionId\s*[:：]\s*([^\n]+)/i)?.[1],
      text.match(/directionId\s*[:：]\s*([^\n]+)/i)?.[1]
    ),
    batchRunId: firstNonEmptyString(
      getPromptSpecBatchString(promptSpec, 'batchRunId'),
      text.match(/batchRunId\s*[:：]\s*([^\n]+)/i)?.[1]
    ),
    batchTaskId: firstNonEmptyString(
      getPromptSpecBatchString(promptSpec, 'batchTaskId'),
      text.match(/batchTaskId\s*[:：]\s*([^\n]+)/i)?.[1]
    ),
  };
};

const getGeneratedImages = (metadata?: CoworkMessageMetadata): GeneratedImageInput[] => {
  const images = metadata?.generatedImages;
  if (!Array.isArray(images)) return [];
  return images.filter((image): image is GeneratedImageInput => (
    Boolean(image)
    && typeof image === 'object'
    && typeof (image as GeneratedImageInput).path === 'string'
    && (image as GeneratedImageInput).path.trim().length > 0
  ));
};

const getImageName = (image: GeneratedImageInput): string => {
  if (image.name?.trim()) return image.name.trim();
  return path.basename(image.path.trim()) || 'generated-image.png';
};

export class CreatorAssetStore {
  constructor(private readonly db: Database.Database) {}

  handleCoworkMessageInserted(input: { sessionId: string; message: CoworkMessage }): void {
    try {
      if (input.message.type === 'user') {
        this.createRunFromPrompt(input.sessionId, input.message.content, input.message.timestamp);
        return;
      }
      if (input.message.type === 'assistant') {
        this.ingestGeneratedImages(input.sessionId, input.message);
      }
    } catch (error) {
      console.warn('[CreatorAssetStore] failed to process cowork message:', error);
    }
  }

  createRunFromPrompt(sessionId: string, prompt: string, createdAt: number = Date.now()): CreatorProductionRunRecord | null {
    const context = parseCreatorStudioSourceContext(prompt);
    if (!context) return null;
    return this.createRun(sessionId, context, createdAt);
  }

  getWorkspace(): CreatorWorkspaceSnapshot {
    this.ensureDefaultProject();
    const currentProjectId = this.getCurrentProjectId();
    return {
      currentProjectId,
      projects: this.listProjects(),
      collections: this.listCollections(currentProjectId),
    };
  }

  createProject(input: CreatorProjectCreateInput): CreatorWorkspaceSnapshot {
    const name = input.name.trim().slice(0, 80);
    if (!name) {
      throw new Error('Project name is required');
    }
    const now = Date.now();
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO creator_projects (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, normalizeOptionalText(input.description), now, now);
    this.setCurrentProject(id);
    return this.getWorkspace();
  }

  setCurrentProject(projectId: string): CreatorWorkspaceSnapshot {
    const project = this.db.prepare('SELECT id FROM creator_projects WHERE id = ?').get(projectId) as { id: string } | undefined;
    if (!project) {
      throw new Error('Project not found');
    }
    this.db.prepare(`
      INSERT INTO creator_workspace_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(CreatorWorkspaceStateKey.CurrentProjectId, projectId, Date.now());
    return this.getWorkspace();
  }

  createCollection(input: CreatorAssetCollectionCreateInput): CreatorWorkspaceSnapshot {
    const projectId = input.projectId.trim();
    const name = input.name.trim().slice(0, 80);
    if (!projectId || !name) {
      throw new Error('projectId and collection name are required');
    }
    const project = this.db.prepare('SELECT id FROM creator_projects WHERE id = ?').get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO creator_asset_collections (id, project_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), projectId, name, normalizeOptionalText(input.description), now, now);
    return this.getWorkspace();
  }

  addAssetToCollection(input: CreatorAssetCollectionAddInput): CreatorProductionAssetRecord | null {
    const asset = this.getAsset(input.assetId);
    const collection = this.db.prepare(`
      SELECT id, project_id
      FROM creator_asset_collections
      WHERE id = ?
    `).get(input.collectionId) as { id: string; project_id: string } | undefined;
    if (!asset || !collection) {
      return null;
    }
    if (asset.projectId !== collection.project_id) {
      this.db.prepare('UPDATE production_assets SET project_id = ?, updated_at = ? WHERE id = ?')
        .run(collection.project_id, Date.now(), asset.id);
    }
    this.db.prepare(`
      INSERT OR IGNORE INTO creator_asset_collection_items (collection_id, asset_id, added_at)
      VALUES (?, ?, ?)
    `).run(collection.id, asset.id, Date.now());
    return this.getAsset(asset.id);
  }

  createPromptAsset(input: CreatorPromptAssetCreateInput): CreatorProductionAssetRecord {
    const projectId = input.projectId.trim() || this.getCurrentProjectId();
    const project = this.db.prepare('SELECT id FROM creator_projects WHERE id = ?').get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    const title = input.title.trim().slice(0, 120) || 'Creator Prompt';
    const promptText = input.promptText.trim();
    if (!promptText) {
      throw new Error('Prompt text is required');
    }
    const now = Date.now();
    const id = uuidv4();
    const caseIds = normalizeTags(input.caseIds ?? []);
    const tags = normalizeTags(input.tags ?? []);
    const selectedDirectionId = normalizeOptionalText(input.selectedDirectionId)
      ?? (typeof input.promptSpec.selectedCreativeDirectionId === 'string' ? input.promptSpec.selectedCreativeDirectionId : null);
    const promptSpec = ensurePromptSpecV1Snapshot({
      ...input.promptSpec,
      ...(input.parentPromptAssetId ? { parentPromptAssetId: input.parentPromptAssetId } : {}),
      ...(input.recipeId ? { recipeId: input.recipeId } : {}),
      ...(selectedDirectionId ? { selectedDirectionId } : {}),
    }, title);
    const promptSpecJson = JSON.stringify(promptSpec);
    const caseIdsJson = JSON.stringify(caseIds);
    this.db.prepare(`
      INSERT INTO production_assets (
        id, project_id, kind, title, status, source, run_id, source_run_id, variant_of_asset_id, session_id,
        source_session_id, message_id, source_message_id, template_id,
        case_ids, case_ids_json, prompt_spec, prompt_spec_json, prompt_text,
        parent_prompt_asset_id, prompt_version_id, recipe_id, selected_direction_id,
        file_path, file_name, mime_type,
        favorite, adoption_status, tags_json, license_note, usage_note, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, 0, ?, ?, NULL, NULL, ?, ?, ?)
    `).run(
      id,
      projectId,
      CreatorProductionAssetKind.Prompt,
      title,
      CreatorProductionAssetStatus.Ready,
      CreatorProductionAssetSource.CreatorPrompt,
      input.parentPromptAssetId ?? null,
      input.templateId ?? null,
      caseIdsJson,
      caseIdsJson,
      promptSpecJson,
      promptSpecJson,
      promptText,
      input.parentPromptAssetId ?? null,
      input.recipeId ?? null,
      selectedDirectionId,
      `creator://prompt/${id}`,
      `${title}.prompt.txt`,
      CreatorAssetAdoptionStatus.Unset,
      JSON.stringify(tags),
      JSON.stringify({ sourceTitle: promptSpec.sourceTitle ?? title }),
      now,
      now
    );
    this.createPromptVersion({
      promptAssetId: id,
      promptText,
      promptSpec,
      changeNote: input.changeNote ?? 'Initial prompt version',
    });
    return this.getAsset(id)!;
  }

  createCaseAsset(input: CreatorCaseAssetCreateInput): CreatorProductionAssetRecord {
    const projectId = input.projectId.trim() || this.getCurrentProjectId();
    const project = this.db.prepare('SELECT id FROM creator_projects WHERE id = ?').get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    const caseId = input.caseId.trim();
    const title = input.title.trim().slice(0, 120) || 'Creator Case';
    const promptText = input.promptText.trim();
    if (!caseId || !promptText) {
      throw new Error('Case id and prompt text are required');
    }
    const now = Date.now();
    const id = uuidv4();
    const caseIds = [caseId];
    const tags = normalizeTags([
      input.category ?? '',
      ...(input.styles ?? []),
      ...(input.scenes ?? []),
      ...(input.tags ?? []),
    ]);
    const promptSpec = {
      sourceType: 'case',
      sourceId: caseId,
      sourceTitle: title,
      category: input.category ?? undefined,
      caseIds,
      styles: normalizeTags(input.styles ?? []),
      scenes: normalizeTags(input.scenes ?? []),
      referencePrompt: promptText,
    };
    const promptSpecJson = JSON.stringify(promptSpec);
    const caseIdsJson = JSON.stringify(caseIds);
    this.db.prepare(`
      INSERT INTO production_assets (
        id, project_id, kind, title, status, source, run_id, source_run_id, variant_of_asset_id, session_id,
        source_session_id, message_id, source_message_id, template_id,
        case_ids, case_ids_json, prompt_spec, prompt_spec_json, prompt_text, file_path, file_name, mime_type,
        favorite, adoption_status, tags_json, license_note, usage_note, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, NULL, NULL, ?, ?, ?)
    `).run(
      id,
      projectId,
      CreatorProductionAssetKind.Case,
      title,
      CreatorProductionAssetStatus.Ready,
      CreatorProductionAssetSource.CreatorCase,
      caseIdsJson,
      caseIdsJson,
      promptSpecJson,
      promptSpecJson,
      promptText,
      `creator://case/${caseId}`,
      `${title}.case.txt`,
      CreatorAssetAdoptionStatus.Unset,
      JSON.stringify(tags),
      JSON.stringify({
        sourceLabel: input.sourceLabel ?? null,
        sourceUrl: input.sourceUrl ?? null,
        githubUrl: input.githubUrl ?? null,
      }),
      now,
      now
    );
    return this.getAsset(id)!;
  }

  createRecipe(input: CreatorRecipeCreateInput): CreatorRecipeRecord {
    const projectId = input.projectId.trim() || this.getCurrentProjectId();
    this.ensureProjectExists(projectId);
    const title = input.title.trim().slice(0, 120);
    if (!title) {
      throw new Error('Recipe title is required');
    }
    if (!input.promptSpec || typeof input.promptSpec !== 'object') {
      throw new Error('Prompt spec is required');
    }
    const now = Date.now();
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO creator_recipes (
        id, project_id, title, description, source_prompt_asset_id,
        prompt_spec_json, default_runtime_json, default_output_json, tags_json,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      title,
      normalizeOptionalText(input.description),
      normalizeOptionalText(input.sourcePromptAssetId),
      JSON.stringify(input.promptSpec),
      JSON.stringify(input.defaultRuntime ?? {}),
      JSON.stringify(input.defaultOutput ?? {}),
      JSON.stringify(normalizeTags(input.tags ?? [])),
      now,
      now
    );
    return this.getRecipe(id)!;
  }

  importRecipe(input: CreatorRecipeImportInput): CreatorRecipeRecord {
    return this.createRecipe({
      ...input.recipe,
      projectId: input.projectId,
    });
  }

  listRecipes(input: CreatorRecipeListInput = {}): CreatorRecipeListResult {
    const projectId = input.projectId?.trim() || this.getCurrentProjectId();
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 50), 200));
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const clauses = ['project_id = ?'];
    const params: unknown[] = [projectId];
    if (input.tag?.trim()) {
      clauses.push('tags_json LIKE ?');
      params.push(`%"${input.tag.trim().replace(/"/g, '\\"')}"%`);
    }
    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const rows = this.db.prepare(`
      SELECT id, project_id, title, description, source_prompt_asset_id,
        prompt_spec_json, default_runtime_json, default_output_json, tags_json,
        created_at, updated_at
      FROM creator_recipes
      ${whereSql}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as RecipeRow[];
    const totalRow = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM creator_recipes
      ${whereSql}
    `).get(...params) as { count: number };
    return {
      recipes: rows.map((row) => this.mapRecipeRow(row)),
      total: totalRow.count,
    };
  }

  getRecipe(id: string): CreatorRecipeRecord | null {
    const row = this.db.prepare(`
      SELECT id, project_id, title, description, source_prompt_asset_id,
        prompt_spec_json, default_runtime_json, default_output_json, tags_json,
        created_at, updated_at
      FROM creator_recipes
      WHERE id = ?
    `).get(id) as RecipeRow | undefined;
    return row ? this.mapRecipeRow(row) : null;
  }

  createPromptVersion(input: CreatorPromptVersionCreateInput): CreatorPromptVersionRecord {
    const asset = this.getAsset(input.promptAssetId);
    if (!asset || asset.kind !== CreatorProductionAssetKind.Prompt) {
      throw new Error('Prompt asset not found');
    }
    const promptText = input.promptText.trim();
    if (!promptText) {
      throw new Error('Prompt text is required');
    }
    const current = this.db.prepare(`
      SELECT COALESCE(MAX(version), 0) AS version
      FROM creator_prompt_versions
      WHERE prompt_asset_id = ?
    `).get(asset.id) as { version: number };
    const now = Date.now();
    const id = uuidv4();
    const nextVersion = current.version + 1;
    const promptSpecJson = JSON.stringify(ensurePromptSpecV1Snapshot({
      ...input.promptSpec,
      promptAssetId: asset.id,
      promptVersion: nextVersion,
    }, asset.fileName));
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO creator_prompt_versions (
          id, prompt_asset_id, version, prompt_text, prompt_spec_json, change_note, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        asset.id,
        nextVersion,
        promptText,
        promptSpecJson,
        normalizeOptionalText(input.changeNote),
        now
      );
      this.db.prepare(`
        UPDATE production_assets
        SET prompt_text = ?,
          prompt_spec = ?,
          prompt_spec_json = ?,
          prompt_version_id = ?,
          updated_at = ?
        WHERE id = ?
      `).run(promptText, promptSpecJson, promptSpecJson, id, now, asset.id);
    })();
    return this.getPromptVersion(id)!;
  }

  listPromptVersions(input: CreatorPromptVersionListInput): CreatorPromptVersionListResult {
    const promptAssetId = input.promptAssetId.trim();
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 50), 200));
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const rows = this.db.prepare(`
      SELECT id, prompt_asset_id, version, prompt_text, prompt_spec_json, change_note, created_at
      FROM creator_prompt_versions
      WHERE prompt_asset_id = ?
      ORDER BY version DESC
      LIMIT ? OFFSET ?
    `).all(promptAssetId, limit, offset) as PromptVersionRow[];
    const totalRow = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM creator_prompt_versions
      WHERE prompt_asset_id = ?
    `).get(promptAssetId) as { count: number };
    return {
      versions: rows.map((row) => this.mapPromptVersionRow(row)),
      total: totalRow.count,
    };
  }

  getPromptVersion(id: string): CreatorPromptVersionRecord | null {
    const row = this.db.prepare(`
      SELECT id, prompt_asset_id, version, prompt_text, prompt_spec_json, change_note, created_at
      FROM creator_prompt_versions
      WHERE id = ?
    `).get(id) as PromptVersionRow | undefined;
    return row ? this.mapPromptVersionRow(row) : null;
  }

  forkPromptVersion(input: CreatorPromptVersionForkInput): CreatorProductionAssetRecord {
    const version = this.getPromptVersion(input.promptVersionId);
    if (!version) {
      throw new Error('Prompt version not found');
    }
    const sourceAsset = this.getAsset(version.promptAssetId);
    if (!sourceAsset) {
      throw new Error('Prompt asset not found');
    }
    return this.createPromptAsset({
      projectId: input.projectId?.trim() || sourceAsset.projectId,
      title: input.title?.trim() || `${sourceAsset.fileName.replace(/\.prompt\.txt$/i, '')} v${version.version}`,
      promptText: version.promptText,
      promptSpec: {
        ...version.promptSpec,
        parentPromptAssetId: sourceAsset.id,
        forkedFromPromptVersionId: version.id,
      },
      templateId: sourceAsset.templateId,
      caseIds: sourceAsset.caseIds,
      tags: sourceAsset.tags,
      parentPromptAssetId: sourceAsset.id,
      recipeId: sourceAsset.recipeId,
      selectedDirectionId: sourceAsset.selectedDirectionId,
      changeNote: input.changeNote ?? `Forked from v${version.version}`,
    });
  }

  diffPromptVersions(input: CreatorPromptVersionDiffInput): CreatorPromptVersionDiffResult {
    const fromVersion = this.getPromptVersion(input.fromVersionId);
    const toVersion = this.getPromptVersion(input.toVersionId);
    if (!fromVersion || !toVersion) {
      throw new Error('Prompt version not found');
    }
    return {
      fromVersion,
      toVersion,
      promptTextChanged: fromVersion.promptText !== toVersion.promptText,
      promptSpecChanged: JSON.stringify(fromVersion.promptSpec) !== JSON.stringify(toVersion.promptSpec),
      promptTextBefore: fromVersion.promptText,
      promptTextAfter: toVersion.promptText,
      promptSpecBefore: fromVersion.promptSpec,
      promptSpecAfter: toVersion.promptSpec,
    };
  }

  listAssets(input: CreatorProductionAssetListInput = {}): CreatorProductionAssetListResult {
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 60), 200));
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const projectId = input.projectId?.trim() || this.getCurrentProjectId();
    const clauses = ['COALESCE(a.project_id, ?) = ?'];
    const params: unknown[] = [CreatorStudioDefaultProjectId, projectId];
    if (input.collectionId?.trim()) {
      clauses.push(`EXISTS (
        SELECT 1
        FROM creator_asset_collection_items ci
        WHERE ci.asset_id = a.id AND ci.collection_id = ?
      )`);
      params.push(input.collectionId.trim());
    }
    if (input.source?.trim()) {
      clauses.push('a.source = ?');
      params.push(input.source.trim());
    }
    if (input.templateId?.trim()) {
      clauses.push('a.template_id = ?');
      params.push(input.templateId.trim());
    }
    if (input.tag?.trim()) {
      clauses.push('a.tags_json LIKE ?');
      params.push(`%"${input.tag.trim().replace(/"/g, '\\"')}"%`);
    }
    if (input.adoptionStatus?.trim()) {
      clauses.push('a.adoption_status = ?');
      params.push(input.adoptionStatus.trim());
    }
    if (typeof input.favorite === 'boolean') {
      clauses.push('a.favorite = ?');
      params.push(input.favorite ? 1 : 0);
    }
    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const rows = this.db.prepare(`
      SELECT
        a.*,
        CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS source_session_available
      FROM production_assets a
      LEFT JOIN cowork_sessions s ON s.id = COALESCE(a.source_session_id, a.session_id)
      ${whereSql}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as ProductionAssetRow[];
    const totalRow = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM production_assets a
      ${whereSql}
    `).get(...params) as { count: number };
    return {
      assets: rows.map((row) => this.mapAssetRow(row)),
      total: totalRow.count,
    };
  }

  getAsset(id: string): CreatorProductionAssetRecord | null {
    const row = this.db.prepare(`
      SELECT
        a.*,
        CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS source_session_available
      FROM production_assets a
      LEFT JOIN cowork_sessions s ON s.id = COALESCE(a.source_session_id, a.session_id)
      WHERE a.id = ?
    `).get(id) as ProductionAssetRow | undefined;
    return row ? this.mapAssetRow(row) : null;
  }

  getAssetSource(id: string): CreatorProductionAssetSourceLookup | null {
    const asset = this.getAsset(id);
    if (!asset) return null;
    const sourceAssetId = asset.variantOfAssetId ?? asset.imageProcessing?.sourceAssetId ?? null;
    const session = asset.sessionId
      ? this.db.prepare(`
        SELECT id, title, status, created_at, updated_at
        FROM cowork_sessions
        WHERE id = ?
      `).get(asset.sessionId) as {
        id: string;
        title: string;
        status: string;
        created_at: number;
        updated_at: number;
      } | undefined
      : undefined;
    return {
      asset,
      sourceAsset: sourceAssetId ? this.getAsset(sourceAssetId) : null,
      session: session
        ? {
          id: session.id,
          title: session.title,
          status: session.status,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
        }
        : null,
    };
  }

  async inspectImageAsset(input: CreatorImageInspectInput): Promise<CreatorImageInspectResult | null> {
    const assetId = input.assetId?.trim();
    const asset = assetId
      ? this.getAsset(assetId)
      : this.resolveControlledImageAsset(input.source);
    if (!asset || asset.kind !== CreatorProductionAssetKind.Image) {
      return null;
    }

    const resolvedSource = await resolveCreatorImageSourceForProcessing(asset, {
      allowDownloadOriginal: false,
    });
    const imageMetadata = await inspectImageMetadata(resolvedSource.sourcePath);
    const currentMetadata = parseJsonObject(this.getAssetMetadataJson(asset.id));
    this.db.prepare(`
      UPDATE production_assets
      SET metadata = ?,
        status = ?,
        mime_type = COALESCE(?, mime_type),
        updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify({
        ...currentMetadata,
        imageSource: resolvedSource.imageSource,
        imageMetadata: {
          ...imageMetadata,
          warningCodes: [
            ...new Set([
              ...imageMetadata.warningCodes,
              ...resolvedSource.warningCodes,
            ]),
          ],
        },
      }),
      imageMetadata.status === CreatorImageMetadataStatus.Missing
        ? CreatorProductionAssetStatus.Missing
        : asset.status,
      imageMetadata.mimeType,
      Date.now(),
      asset.id
    );

    const updated = this.getAsset(asset.id);
    return updated?.imageMetadata ? { asset: updated, imageMetadata: updated.imageMetadata } : null;
  }

  resolveImageProcessingSourceAsset(input: CreatorImageInspectInput): CreatorProductionAssetRecord | null {
    const assetId = input.assetId?.trim();
    if (assetId) {
      const asset = this.getAsset(assetId);
      return asset?.kind === CreatorProductionAssetKind.Image ? asset : null;
    }
    return this.resolveControlledImageAsset(input.source);
  }

  async prepareImageProcessingAsset(asset: CreatorProductionAssetRecord): Promise<CreatorProductionAssetRecord> {
    if (asset.kind !== CreatorProductionAssetKind.Image) return asset;
    let current = asset;
    if (!current.imageMetadata) {
      const inspected = await this.inspectImageAsset({ assetId: current.id });
      current = inspected?.asset ?? current;
    }
    const resolvedSource = await resolveCreatorImageSourceForProcessing(current);
    if (resolvedSource.sourcePath === current.filePath && current.imageSource?.resolvedPath === resolvedSource.imageSource.resolvedPath) {
      return current;
    }
    const imageMetadata = current.imageMetadata?.sourcePath === resolvedSource.sourcePath
      ? current.imageMetadata
      : await inspectImageMetadata(resolvedSource.sourcePath);
    const currentMetadata = parseJsonObject(this.getAssetMetadataJson(current.id));
    this.db.prepare(`
      UPDATE production_assets
      SET metadata = ?,
        mime_type = COALESCE(?, mime_type),
        updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify({
        ...currentMetadata,
        imageSource: resolvedSource.imageSource,
        imageMetadata: {
          ...imageMetadata,
          warningCodes: [
            ...new Set([
              ...imageMetadata.warningCodes,
              ...resolvedSource.warningCodes,
            ]),
          ],
        },
      }),
      imageMetadata.mimeType,
      Date.now(),
      current.id,
    );
    const updated = this.getAsset(current.id) ?? current;
    return {
      ...updated,
      filePath: resolvedSource.sourcePath,
      imageMetadata: this.getAsset(current.id)?.imageMetadata ?? updated.imageMetadata,
      imageSource: resolvedSource.imageSource,
    };
  }

  createImageProcessingAsset(input: CreatorImageProcessingAssetCreateInput): CreatorProductionAssetRecord {
    const sourceAsset = this.getAsset(input.sourceAssetId);
    if (!sourceAsset || sourceAsset.kind !== CreatorProductionAssetKind.Image) {
      throw new Error('Source image asset not found');
    }
    if (path.resolve(sourceAsset.filePath) === path.resolve(input.outputPath)) {
      throw new Error('Output file must not overwrite the source image');
    }

    const now = Date.now();
    const id = uuidv4();
    const recipeId = input.recipeId ?? input.plan.recipeId ?? sourceAsset.recipeId;
    const isRecipeProcessing = Boolean(input.recipeId ?? input.plan.recipeId)
      || input.plan.createdBy === CreatorImageProcessingCreatedBy.Recipe;
    const metadata = {
      imageMetadata: input.imageMetadata,
      imageSource: buildCreatorImageSourceFile({
        localPath: input.outputPath,
        assetQuality: CreatorImageAssetQuality.Original,
        provider: isRecipeProcessing ? CreatorProductionAssetSource.RecipePostProcessing : CreatorProductionAssetSource.LocalImageProcessing,
        resolvedPath: input.outputPath,
        resolvedReason: 'processed_output',
      }),
      processing: {
        sourceAssetId: sourceAsset.id,
        recipeId,
        plan: input.plan,
        job: input.job,
        task: input.task,
        presetId: input.plan.presetId,
        operations: input.plan.operations,
        readmeSuggestions: input.plan.readmeSuggestions ?? [],
      },
    };

    this.db.prepare(`
      INSERT INTO production_assets (
        id,
        project_id,
        kind,
        title,
        status,
        source,
        run_id,
        source_run_id,
        variant_of_asset_id,
        session_id,
        source_session_id,
        message_id,
        source_message_id,
        template_id,
        case_ids,
        case_ids_json,
        prompt_spec,
        prompt_spec_json,
        prompt_text,
        parent_prompt_asset_id,
        prompt_version_id,
        recipe_id,
        selected_direction_id,
        file_path,
        file_name,
        mime_type,
        favorite,
        adoption_status,
        tags_json,
        license_note,
        usage_note,
        metadata,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sourceAsset.projectId,
      CreatorProductionAssetKind.Image,
      input.fileName,
      CreatorProductionAssetStatus.Ready,
      isRecipeProcessing ? CreatorProductionAssetSource.RecipePostProcessing : CreatorProductionAssetSource.LocalImageProcessing,
      sourceAsset.runId,
      sourceAsset.runId,
      sourceAsset.id,
      null,
      sourceAsset.sessionId,
      null,
      sourceAsset.messageId,
      sourceAsset.templateId,
      JSON.stringify(sourceAsset.caseIds),
      JSON.stringify(sourceAsset.caseIds),
      sourceAsset.promptSpec ? JSON.stringify(sourceAsset.promptSpec) : null,
      sourceAsset.promptSpec ? JSON.stringify(sourceAsset.promptSpec) : null,
      sourceAsset.promptText,
      sourceAsset.parentPromptAssetId,
      sourceAsset.promptVersionId,
      recipeId,
      sourceAsset.selectedDirectionId,
      input.outputPath,
      input.fileName,
      input.mimeType,
      0,
      CreatorAssetAdoptionStatus.Unset,
      JSON.stringify(sourceAsset.tags),
      sourceAsset.licenseNote,
      sourceAsset.usageNote,
      JSON.stringify(metadata),
      now,
      now,
    );

    return this.getAsset(id)!;
  }

  async executeImageProcessingPlan(plan: CreatorImageProcessingPlan): Promise<CreatorImageBatchCreateResult> {
    if (plan.inputItems.length === 0) {
      throw new Error('At least one image input is required');
    }
    const job = this.createImageProcessingJobShell(plan);
    const tasks = plan.inputItems.map((_item, index) => this.createImageProcessingTaskShell(job, plan, index));
    this.insertImageProcessingPlan(plan);
    this.insertImageProcessingJob(job);
    for (const task of tasks) {
      this.insertImageProcessingTask(task);
    }
    const executed = await this.executeImageProcessingJobQueue(plan, job, tasks, 1);
    return {
      plan,
      job: executed.job,
      tasks: executed.tasks,
      outputAssetIds: executed.tasks
        .map((task) => task.outputAssetId)
        .filter((assetId): assetId is string => Boolean(assetId)),
    };
  }

  async createImageProcessingBatchJob(input: CreatorImageBatchCreateInput): Promise<CreatorImageBatchCreateResult> {
    const projectId = input.projectId.trim() || CreatorStudioDefaultProjectId;
    const assetIds = [...new Set(input.assetIds.map((assetId) => assetId.trim()).filter(Boolean))];
    const assets: CreatorProductionAssetRecord[] = [];
    for (const assetId of assetIds) {
      let asset = this.getAsset(assetId);
      if (!asset || asset.kind !== CreatorProductionAssetKind.Image || asset.status !== CreatorProductionAssetStatus.Ready) {
        continue;
      }
      assets.push(await this.prepareImageProcessingAsset(asset));
    }

    if (assets.length === 0) {
      throw new Error('At least one ready image asset is required');
    }

    const plan = createCreatorAssetsImageProcessingPlan({
      projectId,
      assets,
      presetId: input.presetId,
      outputFormat: input.outputFormat,
      quality: input.quality,
      width: input.width,
      height: input.height,
      maxWidth: input.maxWidth,
      maxHeight: input.maxHeight,
      cropRatio: input.cropRatio,
      rotate: input.rotate,
      outputDirectory: input.outputDirectory,
    });
    const job = this.createImageProcessingJobShell(plan);
    const tasks = plan.inputItems.map((_item, index) => this.createImageProcessingTaskShell(job, plan, index));
    this.insertImageProcessingPlan(plan);
    this.insertImageProcessingJob(job);
    for (const task of tasks) {
      this.insertImageProcessingTask(task);
    }

    if (input.waitForCompletion === false) {
      void this.executeImageProcessingJobQueue(plan, job, tasks).catch((error) => {
        console.error('[CreatorImageProcessing] batch job execution failed:', error);
      });
      return {
        plan,
        job,
        tasks,
        outputAssetIds: [],
      };
    }

    const executed = await this.executeImageProcessingJobQueue(plan, job, tasks);
    return {
      plan,
      job: executed.job,
      tasks: executed.tasks,
      outputAssetIds: executed.tasks
        .map((task) => task.outputAssetId)
        .filter((assetId): assetId is string => Boolean(assetId)),
    };
  }

  listImageProcessingJobs(input: CreatorImageJobListInput = {}): CreatorImageJobListResult {
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 20), 100));
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const projectId = input.projectId?.trim();
    const where = projectId ? 'WHERE project_id = ?' : '';
    const args = projectId ? [projectId] : [];
    const rows = this.db.prepare(`
      SELECT * FROM creator_image_processing_jobs
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...args, limit, offset) as ImageProcessingJobRow[];
    const total = (this.db.prepare(`
      SELECT COUNT(*) AS count FROM creator_image_processing_jobs ${where}
    `).get(...args) as { count: number }).count;

    return {
      jobs: rows.map((row) => {
        const job = this.mapImageProcessingJobRow(row);
        return { job, tasks: this.listImageProcessingTasks(job.id) };
      }),
      total,
    };
  }

  getImageProcessingJob(jobId: string): { job: CreatorImageProcessingJob; tasks: CreatorImageProcessingTask[] } | null {
    const row = this.db.prepare(`
      SELECT * FROM creator_image_processing_jobs WHERE id = ? LIMIT 1
    `).get(jobId) as ImageProcessingJobRow | undefined;
    if (!row) return null;
    const job = this.mapImageProcessingJobRow(row);
    return { job, tasks: this.listImageProcessingTasks(job.id) };
  }

  getImageProcessingPlan(planId: string): CreatorImageProcessingPlan | null {
    const row = this.db.prepare(`
      SELECT * FROM creator_image_processing_plans WHERE id = ? LIMIT 1
    `).get(planId) as ImageProcessingPlanRow | undefined;
    if (!row) return null;
    return this.mapImageProcessingPlanRow(row);
  }

  saveImageProcessingPlan(plan: CreatorImageProcessingPlan): CreatorImageProcessingPlan {
    this.insertImageProcessingPlan(plan);
    return plan;
  }

  async executeImageProcessingRecipe(
    input: CreatorImageProcessingRecipeExecuteInput,
  ): Promise<CreatorImageBatchCreateResult> {
    const recipe = this.getRecipe(input.recipeId.trim());
    if (!recipe) {
      throw new Error('Creator recipe not found');
    }
    let asset = this.getAsset(input.assetId.trim());
    if (!asset || asset.kind !== CreatorProductionAssetKind.Image || asset.status !== CreatorProductionAssetStatus.Ready) {
      throw new Error('At least one ready image asset is required');
    }
    asset = await this.prepareImageProcessingAsset(asset);

    const imageOutput = parseCreatorRecipeImageProcessingOutput(recipe.defaultOutput);
    if (!imageOutput) {
      throw new Error('Creator recipe does not declare image processing output');
    }
    const rule = input.ruleId?.trim()
      ? imageOutput.rules.find((item) => item.id === input.ruleId?.trim())
      : imageOutput.rules[0];
    if (!rule) {
      throw new Error('Creator recipe image processing rule not found');
    }

    const outputDirectory = input.outputDirectory?.trim()
      || rule.outputDirectory?.trim()
      || path.join(
        path.dirname(asset.filePath),
        '.wesight',
        'creator-outputs',
        'recipes',
        recipe.id,
        rule.id,
      );
    const plan = createCreatorAssetsImageProcessingPlan({
      projectId: asset.projectId,
      assets: [asset],
      presetId: rule.presetId,
      outputFormat: rule.outputFormat,
      quality: rule.quality,
      width: rule.width,
      height: rule.height,
      maxWidth: rule.maxWidth,
      maxHeight: rule.maxHeight,
      cropRatio: rule.cropRatio,
      rotate: rule.rotate,
      outputDirectory,
      fileNamePattern: rule.fileNamePattern,
      createdBy: CreatorImageProcessingCreatedBy.Recipe,
      recipeId: recipe.id,
    });
    plan.readmeSuggestions = this.createReadmeSuggestionsForRecipeRule(plan, rule, imageOutput.packKind);
    plan.updatedAt = Date.now();

    const job = this.createImageProcessingJobShell(plan);
    const tasks = plan.inputItems.map((_item, index) => this.createImageProcessingTaskShell(job, plan, index));
    this.insertImageProcessingPlan(plan);
    this.insertImageProcessingJob(job);
    for (const task of tasks) {
      this.insertImageProcessingTask(task);
    }

    if (input.waitForCompletion === false) {
      void this.executeImageProcessingJobQueue(plan, job, tasks, 1).catch((error) => {
        console.error('[CreatorImageProcessing] recipe job execution failed:', error);
      });
      return {
        plan,
        job,
        tasks,
        outputAssetIds: [],
      };
    }

    const executed = await this.executeImageProcessingJobQueue(plan, job, tasks, 1);
    return {
      plan,
      job: executed.job,
      tasks: executed.tasks,
      outputAssetIds: executed.tasks
        .map((task) => task.outputAssetId)
        .filter((assetId): assetId is string => Boolean(assetId)),
    };
  }

  private createReadmeSuggestionsForRecipeRule(
    plan: CreatorImageProcessingPlan,
    rule: CreatorRecipeImageProcessingRule,
    packKind: CreatorRecipeImageProcessingPackKind,
  ): NonNullable<CreatorImageProcessingPlan['readmeSuggestions']> {
    if (packKind !== CreatorRecipeImageProcessingPackKind.ReadmeBannerPack) {
      return [];
    }
    return plan.outputItems.map((outputItem) => {
      const relativePath = rule.readmeSuggestion?.outputRelativePath?.trim()
        || path.posix.join('assets', outputItem.fileName);
      return {
        outputPath: outputItem.outputPath,
        markdown: rule.readmeSuggestion?.markdown?.trim()
          || `![README banner](${relativePath})`,
        note: rule.readmeSuggestion?.note
          ?? 'Generated suggestion only. WeSight does not modify README files automatically.',
      };
    });
  }

  async retryImageProcessingTask(taskId: string): Promise<CreatorImageTaskRetryResult | null> {
    const taskRow = this.db.prepare(`
      SELECT * FROM creator_image_processing_tasks WHERE id = ? LIMIT 1
    `).get(taskId) as ImageProcessingTaskRow | undefined;
    if (!taskRow) return null;
    const jobRecord = this.getImageProcessingJob(taskRow.job_id);
    if (!jobRecord) return null;
    const plan = this.getImageProcessingPlan(jobRecord.job.planId);
    if (!plan) return null;
    const index = jobRecord.tasks.findIndex((task) => task.id === taskId);
    if (index < 0) return null;

    const task: CreatorImageProcessingTask = {
      ...jobRecord.tasks[index],
      status: CreatorImageProcessingTaskStatus.Pending,
      outputAssetId: null,
      outputSize: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      updatedAt: Date.now(),
    };
    this.updateImageProcessingTask(task);
    const executed = await this.executeImageProcessingJobQueue(plan, jobRecord.job, [task], 1);
    return {
      job: executed.job,
      tasks: this.listImageProcessingTasks(executed.job.id),
      outputAssetIds: executed.tasks
        .map((item) => item.outputAssetId)
        .filter((assetId): assetId is string => Boolean(assetId)),
    };
  }

  cancelImageProcessingTask(taskId: string): CreatorImageTaskCancelResult | null {
    const taskRow = this.db.prepare(`
      SELECT * FROM creator_image_processing_tasks WHERE id = ? LIMIT 1
    `).get(taskId) as ImageProcessingTaskRow | undefined;
    if (!taskRow || taskRow.status !== CreatorImageProcessingTaskStatus.Pending) {
      return null;
    }
    const task = this.mapImageProcessingTaskRow(taskRow);
    task.status = CreatorImageProcessingTaskStatus.Canceled;
    task.updatedAt = Date.now();
    task.completedAt = task.updatedAt;
    this.updateImageProcessingTask(task);
    const jobRecord = this.getImageProcessingJob(task.jobId);
    if (!jobRecord) return null;
    const job = this.recalculateImageProcessingJob(jobRecord.job);
    return {
      job,
      tasks: this.listImageProcessingTasks(job.id),
    };
  }

  private createImageProcessingJobShell(plan: CreatorImageProcessingPlan): CreatorImageProcessingJob {
    const now = Date.now();
    return {
      id: `job-${plan.id}`,
      projectId: plan.projectId,
      planId: plan.id,
      status: CreatorImageProcessingJobStatus.Pending,
      totalCount: plan.inputItems.length,
      successCount: 0,
      failedCount: 0,
      inputTotalSize: plan.inputItems.reduce((total, item) => total + (item.metadata?.fileSize ?? 0), 0),
      outputTotalSize: 0,
      savedSize: 0,
      savedPercentage: 0,
      runtimeMetrics: null,
      reportAssetId: null,
      reportPath: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
    };
  }

  private createImageProcessingTaskShell(
    job: CreatorImageProcessingJob,
    plan: CreatorImageProcessingPlan,
    inputIndex: number,
  ): CreatorImageProcessingTask {
    const inputItem = plan.inputItems[inputIndex];
    const outputItem = plan.outputItems[inputIndex];
    if (!inputItem || !outputItem) {
      throw new Error('Image processing input item is missing');
    }
    const now = Date.now();
    return {
      id: `task-${job.id}-${inputItem.id}`,
      jobId: job.id,
      projectId: plan.projectId,
      sourceAssetId: inputItem.sourceAssetId,
      outputAssetId: null,
      sourceArtifactId: inputItem.source.artifactId ?? null,
      sourcePath: inputItem.sourcePath,
      outputPath: outputItem.outputPath,
      status: CreatorImageProcessingTaskStatus.Pending,
      inputSize: inputItem.metadata?.fileSize ?? null,
      outputSize: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
  }

  private insertImageProcessingPlan(plan: CreatorImageProcessingPlan): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO creator_image_processing_plans (
        id, project_id, source_json, plan_json, status, preset_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      plan.id,
      plan.projectId,
      JSON.stringify(plan.source),
      JSON.stringify(plan),
      plan.status,
      plan.presetId,
      plan.createdBy,
      plan.createdAt,
      plan.updatedAt,
    );
  }

  private insertImageProcessingJob(job: CreatorImageProcessingJob): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO creator_image_processing_jobs (
        id, project_id, plan_id, status, total_count, success_count, failed_count,
        input_total_size, output_total_size, saved_size, report_asset_id,
        metadata_json, created_at, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.projectId,
      job.planId,
      job.status,
      job.totalCount,
      job.successCount,
      job.failedCount,
      job.inputTotalSize,
      job.outputTotalSize,
      job.savedSize,
      job.reportAssetId,
      JSON.stringify(this.createImageProcessingJobMetadata(job)),
      job.createdAt,
      job.startedAt,
      job.completedAt,
    );
  }

  private insertImageProcessingTask(task: CreatorImageProcessingTask): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO creator_image_processing_tasks (
        id, job_id, project_id, source_asset_id, output_asset_id, source_artifact_id,
        source_path, output_path, status, input_size, output_size, duration_ms,
        error_code, error_message, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.jobId,
      task.projectId,
      task.sourceAssetId,
      task.outputAssetId,
      task.sourceArtifactId,
      task.sourcePath,
      task.outputPath,
      task.status,
      task.inputSize,
      task.outputSize,
      task.durationMs,
      task.errorCode,
      task.errorMessage,
      task.createdAt,
      task.updatedAt,
      task.completedAt,
    );
  }

  private updateImageProcessingTask(task: CreatorImageProcessingTask): void {
    this.db.prepare(`
      UPDATE creator_image_processing_tasks
      SET output_asset_id = ?, output_path = ?, status = ?, input_size = ?, output_size = ?,
        duration_ms = ?, error_code = ?, error_message = ?, updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      task.outputAssetId,
      task.outputPath,
      task.status,
      task.inputSize,
      task.outputSize,
      task.durationMs,
      task.errorCode,
      task.errorMessage,
      task.updatedAt,
      task.completedAt,
      task.id,
    );
  }

  private updateImageProcessingJob(job: CreatorImageProcessingJob): void {
    this.db.prepare(`
      UPDATE creator_image_processing_jobs
      SET status = ?, success_count = ?, failed_count = ?, output_total_size = ?,
        saved_size = ?, report_asset_id = ?, metadata_json = ?, started_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      job.status,
      job.successCount,
      job.failedCount,
      job.outputTotalSize,
      job.savedSize,
      job.reportAssetId,
      JSON.stringify(this.createImageProcessingJobMetadata(job)),
      job.startedAt,
      job.completedAt,
      job.id,
    );
  }

  private createImageProcessingJobMetadata(job: CreatorImageProcessingJob): Record<string, unknown> {
    return {
      savedPercentage: job.savedPercentage,
      runtimeMetrics: job.runtimeMetrics,
      reportPath: job.reportPath,
    };
  }

  private writeImageProcessingReportForJob(
    job: CreatorImageProcessingJob,
    tasks: CreatorImageProcessingTask[],
  ): void {
    const plan = this.getImageProcessingPlan(job.planId);
    if (!plan) return;
    if (!plan.output || !Array.isArray(plan.outputItems)) return;
    const reportDirectory = this.resolveImageProcessingReportDirectory(plan, tasks);
    fs.mkdirSync(reportDirectory, { recursive: true });
    const reportPath = path.join(reportDirectory, `${job.id}-report.md`);
    const report = createImageProcessingReport({
      plan,
      job,
      tasks,
      reportPath,
    });
    if (/base64,/i.test(report.markdown)) {
      console.warn('[CreatorImageProcessing] skipped report because sanitized content still contains base64');
      return;
    }
    fs.writeFileSync(reportPath, report.markdown, 'utf8');
    job.runtimeMetrics = report.metrics;
    job.savedPercentage = report.metrics.savedPercentage;
    job.reportPath = reportPath;
    const reportAsset = this.createImageProcessingReportAsset(report, plan, job, tasks);
    job.reportAssetId = reportAsset.id;
  }

  private resolveImageProcessingReportDirectory(
    plan: CreatorImageProcessingPlan,
    tasks: CreatorImageProcessingTask[],
  ): string {
    const outputDirectory = plan.outputItems.find((item) => item.outputDirectory)?.outputDirectory;
    if (outputDirectory) return outputDirectory;
    const outputPath = tasks.find((task) => task.outputPath)?.outputPath;
    if (outputPath) return path.dirname(outputPath);
    return path.resolve(process.cwd(), '.wesight/creator-outputs/image-processing', plan.id);
  }

  private createImageProcessingReportAsset(
    report: CreatorImageProcessingReport,
    plan: CreatorImageProcessingPlan,
    job: CreatorImageProcessingJob,
    tasks: CreatorImageProcessingTask[],
  ): CreatorProductionAssetRecord {
    if (job.reportAssetId) {
      const existing = this.getAsset(job.reportAssetId);
      if (existing) {
        return existing;
      }
    }

    const firstSourceAsset = plan.inputItems
      .map((item) => item.sourceAssetId ? this.getAsset(item.sourceAssetId) : null)
      .find((asset): asset is CreatorProductionAssetRecord => Boolean(asset));
    const recipeId = plan.recipeId ?? firstSourceAsset?.recipeId ?? null;
    const now = Date.now();
    const id = uuidv4();
    const outputAssetIds = tasks
      .map((task) => task.outputAssetId)
      .filter((assetId): assetId is string => Boolean(assetId));
    const sourceAssetIds = plan.inputItems
      .map((item) => item.sourceAssetId)
      .filter((assetId): assetId is string => Boolean(assetId));
    const metadata = {
      imageProcessingReport: {
        schemaVersion: 'creator.imageProcessingReport.v1',
        jobId: job.id,
        planId: plan.id,
        presetId: plan.presetId,
        metrics: report.metrics,
        failureReasons: report.failureReasons,
        sourceAssetIds,
        outputAssetIds,
        recipeId,
      },
      processing: {
        sourceAssetId: firstSourceAsset?.id ?? sourceAssetIds[0] ?? '',
        recipeId,
        presetId: plan.presetId,
        operations: plan.operations,
        plan,
        job,
        tasks,
        report: {
          path: report.reportPath,
          title: report.title,
        },
        readmeSuggestions: plan.readmeSuggestions ?? [],
      },
    };

    this.db.prepare(`
      INSERT INTO production_assets (
        id,
        project_id,
        kind,
        title,
        status,
        source,
        run_id,
        source_run_id,
        variant_of_asset_id,
        session_id,
        source_session_id,
        message_id,
        source_message_id,
        template_id,
        case_ids,
        case_ids_json,
        prompt_spec,
        prompt_spec_json,
        prompt_text,
        parent_prompt_asset_id,
        prompt_version_id,
        recipe_id,
        selected_direction_id,
        file_path,
        file_name,
        mime_type,
        favorite,
        adoption_status,
        tags_json,
        license_note,
        usage_note,
        metadata,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      job.projectId,
      CreatorProductionAssetKind.Report,
      report.title,
      CreatorProductionAssetStatus.Ready,
      CreatorProductionAssetSource.ImageProcessingReport,
      firstSourceAsset?.runId ?? null,
      firstSourceAsset?.runId ?? null,
      firstSourceAsset?.id ?? null,
      null,
      firstSourceAsset?.sessionId ?? null,
      null,
      firstSourceAsset?.messageId ?? null,
      firstSourceAsset?.templateId ?? null,
      JSON.stringify(firstSourceAsset?.caseIds ?? []),
      JSON.stringify(firstSourceAsset?.caseIds ?? []),
      firstSourceAsset?.promptSpec ? JSON.stringify(firstSourceAsset.promptSpec) : null,
      firstSourceAsset?.promptSpec ? JSON.stringify(firstSourceAsset.promptSpec) : null,
      firstSourceAsset?.promptText ?? '',
      firstSourceAsset?.parentPromptAssetId ?? null,
      firstSourceAsset?.promptVersionId ?? null,
      recipeId,
      firstSourceAsset?.selectedDirectionId ?? null,
      report.reportPath,
      path.basename(report.reportPath),
      'text/markdown',
      0,
      CreatorAssetAdoptionStatus.Unset,
      JSON.stringify(['image-processing-report']),
      firstSourceAsset?.licenseNote ?? null,
      firstSourceAsset?.usageNote ?? null,
      JSON.stringify(metadata),
      now,
      now,
    );

    return this.getAsset(id)!;
  }

  private async executeImageProcessingJobQueue(
    plan: CreatorImageProcessingPlan,
    job: CreatorImageProcessingJob,
    tasks: CreatorImageProcessingTask[],
    concurrency = 2,
  ): Promise<{ job: CreatorImageProcessingJob; tasks: CreatorImageProcessingTask[] }> {
    const startedAt = Date.now();
    job.status = CreatorImageProcessingJobStatus.Running;
    job.startedAt = job.startedAt ?? startedAt;
    job.completedAt = null;
    this.updateImageProcessingJob(job);

    let cursor = 0;
    const runNext = async (): Promise<void> => {
      const task = tasks[cursor];
      cursor += 1;
      if (!task) return;
      const latestRow = this.db.prepare(`
        SELECT * FROM creator_image_processing_tasks WHERE id = ? LIMIT 1
      `).get(task.id) as ImageProcessingTaskRow | undefined;
      if (latestRow?.status === CreatorImageProcessingTaskStatus.Canceled) {
        await runNext();
        return;
      }
      const inputIndex = plan.inputItems.findIndex((item) => item.sourceAssetId === task.sourceAssetId && item.sourcePath === task.sourcePath);
      task.status = CreatorImageProcessingTaskStatus.Running;
      task.updatedAt = Date.now();
      this.updateImageProcessingTask(task);

      await executeImageProcessingTask({
        plan,
        task,
        inputIndex: inputIndex >= 0 ? inputIndex : 0,
        createAsset: (assetInput) => {
          if (!task.sourceAssetId) {
            throw new Error('source asset is required');
          }
          return this.createImageProcessingAsset({
            sourceAssetId: task.sourceAssetId,
            outputPath: assetInput.outputPath,
            fileName: assetInput.fileName,
            mimeType: assetInput.mimeType,
            imageMetadata: assetInput.imageMetadata,
            plan: assetInput.plan,
            job,
            task: assetInput.task,
            recipeId: plan.recipeId,
          });
        },
      });
      this.updateImageProcessingTask(task);
      await runNext();
    };

    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => runNext()));
    const recalculatedJob = this.recalculateImageProcessingJob(job);
    return { job: recalculatedJob, tasks: this.listImageProcessingTasks(job.id) };
  }

  private recalculateImageProcessingJob(job: CreatorImageProcessingJob): CreatorImageProcessingJob {
    const tasks = this.listImageProcessingTasks(job.id);
    job.successCount = tasks.filter((task) => task.status === CreatorImageProcessingTaskStatus.Completed).length;
    job.failedCount = tasks.filter((task) => task.status === CreatorImageProcessingTaskStatus.Failed).length;
    job.outputTotalSize = tasks.reduce((total, task) => total + (task.outputSize ?? 0), 0);
    job.savedSize = job.inputTotalSize - job.outputTotalSize;
    job.savedPercentage = job.inputTotalSize > 0
      ? Math.round((job.savedSize / job.inputTotalSize) * 10000) / 100
      : 0;
    const pendingCount = tasks.filter((task) => task.status === CreatorImageProcessingTaskStatus.Pending).length;
    const runningCount = tasks.filter((task) => task.status === CreatorImageProcessingTaskStatus.Running).length;
    const canceledCount = tasks.filter((task) => task.status === CreatorImageProcessingTaskStatus.Canceled).length;
    const terminalCount = tasks.filter((task) => (
      task.status === CreatorImageProcessingTaskStatus.Completed
      || task.status === CreatorImageProcessingTaskStatus.Failed
      || task.status === CreatorImageProcessingTaskStatus.Canceled
      || task.status === CreatorImageProcessingTaskStatus.Skipped
    )).length;
    if (pendingCount > 0 || runningCount > 0) {
      job.status = CreatorImageProcessingJobStatus.Running;
      job.completedAt = null;
    } else if (terminalCount === tasks.length) {
      job.completedAt = Date.now();
      job.status = canceledCount === tasks.length
        ? CreatorImageProcessingJobStatus.Canceled
        : job.failedCount > 0
        ? job.successCount > 0
          ? CreatorImageProcessingJobStatus.PartialFailed
          : CreatorImageProcessingJobStatus.Failed
        : CreatorImageProcessingJobStatus.Completed;
      this.writeImageProcessingReportForJob(job, tasks);
    }
    this.updateImageProcessingJob(job);
    return job;
  }

  private resolveControlledImageAsset(source: CreatorImageInspectInput['source']): CreatorProductionAssetRecord | null {
    const sessionId = source?.sessionId?.trim();
    const messageId = source?.messageId?.trim() ?? null;
    const filePath = source?.filePath?.trim();
    if (!sessionId || !filePath) {
      return null;
    }

    const row = this.db.prepare(`
      SELECT
        a.*,
        CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS source_session_available
      FROM production_assets a
      LEFT JOIN cowork_sessions s ON s.id = COALESCE(a.source_session_id, a.session_id)
      WHERE COALESCE(a.source_session_id, a.session_id) = ?
        AND (? IS NULL OR COALESCE(a.source_message_id, a.message_id) = ?)
        AND a.file_path = ?
        AND a.kind = ?
        AND a.source IN (?, ?)
      LIMIT 1
    `).get(
      sessionId,
      messageId,
      messageId,
      filePath,
      CreatorProductionAssetKind.Image,
      CreatorProductionAssetSource.CoworkGeneratedImage,
      CreatorProductionAssetSource.LocalImageProcessing,
    ) as ProductionAssetRow | undefined;

    if (row) {
      return this.mapAssetRow(row);
    }

    return messageId
      ? this.createControlledGeneratedImageAsset({ sessionId, messageId, filePath })
        ?? this.createControlledActivityImageAsset({
          sessionId,
          messageId,
          artifactId: source?.artifactId,
          filePath,
        })
      : this.createControlledActivityImageAsset({ sessionId, artifactId: source?.artifactId, filePath });
  }

  private createControlledGeneratedImageAsset(input: {
    sessionId: string;
    messageId: string;
    filePath: string;
  }): CreatorProductionAssetRecord | null {
    const row = this.db.prepare(`
      SELECT id, session_id, type, content, metadata, created_at, sequence
      FROM cowork_messages
      WHERE session_id = ? AND id = ?
      LIMIT 1
    `).get(input.sessionId, input.messageId) as {
      id: string;
      session_id: string;
      type: string;
      content: string;
      metadata: string | null;
      created_at: number;
      sequence: number | null;
    } | undefined;
    if (!row) return null;

    const metadata = parseJsonObject(row.metadata) as CoworkMessageMetadata;
    const image = getGeneratedImages(metadata).find((item) => item.path.trim() === input.filePath);
    if (!image) return null;

    return this.upsertControlledImageAsset({
      sessionId: input.sessionId,
      messageId: input.messageId,
      image,
      timestamp: row.created_at,
      source: CreatorProductionAssetSource.CoworkGeneratedImage,
      metadata: getGeneratedImageSourceMetadata(image),
    });
  }

  private createControlledActivityImageAsset(input: {
    sessionId: string;
    messageId?: string | null;
    artifactId?: string;
    filePath: string;
  }): CreatorProductionAssetRecord | null {
    const rows = this.db.prepare(`
      SELECT id, type, content, metadata, created_at, sequence
      FROM cowork_messages
      WHERE session_id = ?
        AND (? IS NULL OR id = ?)
      ORDER BY COALESCE(sequence, 0) ASC, created_at ASC
    `).all(input.sessionId, input.messageId ?? null, input.messageId ?? null) as Array<{
      id: string;
      type: string;
      content: string;
      metadata: string | null;
      created_at: number;
      sequence: number | null;
    }>;

    for (const row of rows) {
      const metadata = parseJsonObject(row.metadata) as CoworkMessageMetadata;
      const generatedImage = getGeneratedImages(metadata).find((item) => item.path.trim() === input.filePath);
      if (generatedImage) {
        return this.upsertControlledImageAsset({
          sessionId: input.sessionId,
          messageId: row.id,
          image: generatedImage,
          timestamp: row.created_at,
          source: CreatorProductionAssetSource.CoworkGeneratedImage,
          metadata: {
            activityArtifactId: input.artifactId ?? null,
            ...getGeneratedImageSourceMetadata(generatedImage),
          },
        });
      }

      if (row.type === 'assistant' && this.messageContentLinksFile(row.content, input.filePath)) {
        return this.upsertControlledImageAsset({
          sessionId: input.sessionId,
          messageId: row.id,
          image: {
            path: input.filePath,
            name: path.basename(input.filePath),
          },
          timestamp: row.created_at,
          source: CreatorProductionAssetSource.CoworkGeneratedImage,
          metadata: {
            activityArtifactId: input.artifactId ?? null,
            activityArtifactSource: 'assistant_file_link',
            imageSource: buildCreatorImageSourceFile({
              localPath: input.filePath,
              assetQuality: CreatorImageAssetQuality.Unknown,
              provider: CreatorProductionAssetSource.CoworkGeneratedImage,
            }),
          },
        });
      }
    }

    return null;
  }

  private messageContentLinksFile(content: string, filePath: string): boolean {
    const normalizedTarget = path.resolve(filePath);
    const linkPattern = /\[([^\]]+)\]\((file:\/\/[^)\s]+|\/[^)\s]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
      const rawPath = match[2]?.trim().replace(/^file:\/\//i, '');
      if (rawPath && path.resolve(rawPath) === normalizedTarget) {
        return true;
      }
    }
    return false;
  }

  private upsertControlledImageAsset(input: {
    sessionId: string;
    messageId: string;
    image: GeneratedImageInput;
    timestamp: number;
    source: CreatorProductionAssetSource;
    metadata: Record<string, unknown>;
  }): CreatorProductionAssetRecord | null {
    const run = this.getLatestPendingRunForSession(input.sessionId)
      ?? this.createRunFromLatestPrompt(input.sessionId, input.timestamp);
    const context = this.getImageAssetContextFromRun(run);
    const filePath = input.image.path.trim();
    const now = input.timestamp || Date.now();
    const caseIdsJson = JSON.stringify(context.caseIds);
    const promptSpecJson = context.promptSpec ? JSON.stringify(context.promptSpec) : null;
    this.db.prepare(`
      INSERT INTO production_assets (
        id, project_id, kind, title, status, source, run_id, source_run_id, variant_of_asset_id, session_id,
        source_session_id, message_id, source_message_id, template_id,
        case_ids, case_ids_json, prompt_spec, prompt_spec_json, prompt_text,
        parent_prompt_asset_id, prompt_version_id, recipe_id, selected_direction_id,
        file_path, file_name, mime_type,
        favorite, adoption_status, tags_json, license_note, usage_note, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, message_id, file_path) DO UPDATE SET
        status = excluded.status,
        run_id = COALESCE(production_assets.run_id, excluded.run_id),
        source_run_id = COALESCE(production_assets.source_run_id, excluded.source_run_id),
        variant_of_asset_id = COALESCE(production_assets.variant_of_asset_id, excluded.variant_of_asset_id),
        source_session_id = COALESCE(production_assets.source_session_id, excluded.source_session_id),
        source_message_id = COALESCE(production_assets.source_message_id, excluded.source_message_id),
        template_id = COALESCE(production_assets.template_id, excluded.template_id),
        case_ids = excluded.case_ids,
        case_ids_json = excluded.case_ids_json,
        prompt_spec = excluded.prompt_spec,
        prompt_spec_json = excluded.prompt_spec_json,
        prompt_text = excluded.prompt_text,
        parent_prompt_asset_id = COALESCE(production_assets.parent_prompt_asset_id, excluded.parent_prompt_asset_id),
        prompt_version_id = COALESCE(production_assets.prompt_version_id, excluded.prompt_version_id),
        recipe_id = COALESCE(production_assets.recipe_id, excluded.recipe_id),
        selected_direction_id = COALESCE(production_assets.selected_direction_id, excluded.selected_direction_id),
        title = excluded.title,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `).run(
      uuidv4(),
      this.getCurrentProjectId(),
      CreatorProductionAssetKind.Image,
      getImageName(input.image),
      fs.existsSync(filePath) ? CreatorProductionAssetStatus.Ready : CreatorProductionAssetStatus.Missing,
      input.source,
      run?.id ?? null,
      run?.id ?? null,
      context.variantOfAssetId,
      input.sessionId,
      input.sessionId,
      input.messageId,
      input.messageId,
      context.templateId,
      caseIdsJson,
      caseIdsJson,
      promptSpecJson,
      promptSpecJson,
      context.promptText,
      context.variantOfAssetId,
      context.promptVersionId,
      context.recipeId,
      context.selectedDirectionId,
      filePath,
      getImageName(input.image),
      input.image.mimeType || null,
      0,
      CreatorAssetAdoptionStatus.Unset,
      '[]',
      null,
      null,
      JSON.stringify(input.metadata),
      now,
      now,
    );

    const assetRow = this.db.prepare(`
      SELECT id
      FROM production_assets
      WHERE session_id = ? AND message_id = ? AND file_path = ?
      LIMIT 1
    `).get(input.sessionId, input.messageId, filePath) as { id: string } | undefined;
    return assetRow?.id ? this.getAsset(assetRow.id) : null;
  }

  private getAssetMetadataJson(assetId: string): string | null {
    const row = this.db.prepare('SELECT metadata FROM production_assets WHERE id = ?')
      .get(assetId) as { metadata: string | null } | undefined;
    return row?.metadata ?? null;
  }

  setFavorite(id: string, favorite: boolean): CreatorProductionAssetRecord | null {
    this.db.prepare(`
      UPDATE production_assets
      SET favorite = ?,
        adoption_status = CASE
          WHEN ? = 1 THEN ?
          WHEN adoption_status = ? THEN ?
          ELSE adoption_status
        END,
        updated_at = ?
      WHERE id = ?
    `).run(
      favorite ? 1 : 0,
      favorite ? 1 : 0,
      CreatorAssetAdoptionStatus.Favorite,
      CreatorAssetAdoptionStatus.Favorite,
      CreatorAssetAdoptionStatus.Unset,
      Date.now(),
      id
    );
    return this.getAsset(id);
  }

  updateAsset(input: CreatorAssetUpdateInput): CreatorProductionAssetRecord | null {
    const asset = this.getAsset(input.assetId);
    if (!asset) return null;
    const favorite = typeof input.favorite === 'boolean' ? input.favorite : asset.favorite;
    const adoptionStatus = isAdoptionStatus(input.adoptionStatus)
      ? input.adoptionStatus
      : favorite && asset.adoptionStatus === CreatorAssetAdoptionStatus.Unset
        ? CreatorAssetAdoptionStatus.Favorite
        : asset.adoptionStatus;
    const projectId = input.projectId?.trim() || asset.projectId;
    const tags = Array.isArray(input.tags) ? normalizeTags(input.tags) : asset.tags;
    const now = Date.now();
    this.db.prepare(`
      UPDATE production_assets
      SET project_id = ?,
        favorite = ?,
        adoption_status = ?,
        tags_json = ?,
        license_note = ?,
        usage_note = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      projectId,
      favorite ? 1 : 0,
      adoptionStatus,
      JSON.stringify(tags),
      input.licenseNote === undefined ? asset.licenseNote : normalizeOptionalText(input.licenseNote),
      input.usageNote === undefined ? asset.usageNote : normalizeOptionalText(input.usageNote),
      now,
      asset.id
    );
    if (typeof input.selected === 'boolean') {
      if (input.selected) {
        this.db.prepare(`
          INSERT INTO creator_asset_selections (project_id, asset_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(project_id, asset_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
        `).run(projectId, asset.id, CreatorAssetSelectionStatus.Selected, now, now);
      } else {
        this.db.prepare(`
          INSERT INTO creator_asset_selections (project_id, asset_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(project_id, asset_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
        `).run(projectId, asset.id, CreatorAssetSelectionStatus.Unselected, now, now);
      }
    }
    return this.getAsset(asset.id);
  }

  getBoardWorkspace(projectIdInput?: string): CreatorBoardWorkspaceSnapshot {
    const projectId = projectIdInput?.trim() || this.getCurrentProjectId();
    this.ensureProjectExists(projectId);
    const currentBoardId = this.ensureCurrentBoard(projectId);
    return {
      projectId,
      currentBoardId,
      boards: this.listBoards(projectId),
      cards: this.listBoardCards(currentBoardId),
      selectedCardIds: this.listSelectedBoardCardIds(currentBoardId),
      brandKit: this.getBrandKit(projectId),
    };
  }

  createBoard(input: CreatorBoardCreateInput): CreatorBoardWorkspaceSnapshot {
    const projectId = input.projectId.trim();
    this.ensureProjectExists(projectId);
    const name = input.name.trim().slice(0, 80);
    if (!name) {
      throw new Error('Board name is required');
    }
    const now = Date.now();
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO creator_boards (id, project_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, name, normalizeOptionalText(input.description), now, now);
    this.setCurrentBoardId(projectId, id);
    return this.getBoardWorkspace(projectId);
  }

  setCurrentBoard(projectId: string, boardId: string): CreatorBoardWorkspaceSnapshot {
    const board = this.db.prepare(`
      SELECT id
      FROM creator_boards
      WHERE id = ? AND project_id = ?
    `).get(boardId, projectId) as { id: string } | undefined;
    if (!board) {
      throw new Error('Board not found');
    }
    this.setCurrentBoardId(projectId, boardId);
    return this.getBoardWorkspace(projectId);
  }

  addBoardCard(input: CreatorBoardCardCreateInput): CreatorBoardCardRecord {
    const board = this.getBoardRow(input.boardId);
    if (!board) {
      throw new Error('Board not found');
    }
    if (!Object.values(CreatorBoardCardKind).includes(input.kind)) {
      throw new Error('Board card kind is invalid');
    }
    const now = Date.now();
    const positionRow = this.db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 AS position
      FROM creator_board_cards
      WHERE board_id = ?
    `).get(board.id) as { position: number };
    const asset = input.assetId ? this.getAsset(input.assetId) : null;
    const title = (input.title.trim() || asset?.fileName || 'Board Card').slice(0, 120);
    const promptSpecJson = input.promptSpec ? JSON.stringify(input.promptSpec) : asset?.promptSpec ? JSON.stringify(asset.promptSpec) : null;
    const directionJson = input.direction ? JSON.stringify(input.direction) : null;
    const promptText = (input.promptText ?? asset?.promptText ?? '').trim();
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO creator_board_cards (
        id, board_id, project_id, kind, title, asset_id, case_id, prompt_text,
        prompt_spec_json, direction_json, group_name, notes, position, metadata_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      board.id,
      board.project_id,
      input.kind,
      title,
      input.assetId ?? null,
      input.caseId ?? null,
      promptText,
      promptSpecJson,
      directionJson,
      normalizeOptionalText(input.groupName),
      normalizeOptionalText(input.notes),
      positionRow.position,
      '{}',
      now,
      now
    );
    return this.getBoardCard(id)!;
  }

  updateBoardCard(input: CreatorBoardCardUpdateInput): CreatorBoardCardRecord | null {
    const card = this.getBoardCard(input.cardId);
    if (!card) return null;
    const now = Date.now();
    const nextTitle = input.title === undefined ? card.title : input.title.trim().slice(0, 120) || card.title;
    const nextDirection = input.direction === undefined
      ? card.direction
        ? {
          ...card.direction,
          title: input.title === undefined ? card.direction.title : nextTitle,
        }
        : null
      : input.direction;
    this.db.prepare(`
      UPDATE creator_board_cards
      SET title = ?,
        group_name = ?,
        notes = ?,
        direction_json = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      nextTitle,
      input.groupName === undefined ? card.groupName : normalizeOptionalText(input.groupName),
      input.notes === undefined ? card.notes : normalizeOptionalText(input.notes),
      nextDirection ? JSON.stringify(nextDirection) : null,
      now,
      card.id
    );
    return this.getBoardCard(card.id);
  }

  removeBoardCard(cardId: string): CreatorBoardCardRecord | null {
    const card = this.getBoardCard(cardId);
    if (!card) return null;
    this.db.prepare('DELETE FROM creator_board_selections WHERE card_id = ?').run(card.id);
    this.db.prepare('DELETE FROM creator_board_cards WHERE id = ?').run(card.id);
    this.reindexBoardCards(card.boardId);
    return card;
  }

  moveBoardCard(input: CreatorBoardCardMoveInput): CreatorBoardCardRecord | null {
    const card = this.getBoardCard(input.cardId);
    if (!card) return null;
    const comparator = input.direction === CreatorBoardMoveDirection.Up ? '<' : '>';
    const order = input.direction === CreatorBoardMoveDirection.Up ? 'DESC' : 'ASC';
    const target = this.db.prepare(`
      SELECT id, position
      FROM creator_board_cards
      WHERE board_id = ? AND position ${comparator} ?
      ORDER BY position ${order}
      LIMIT 1
    `).get(card.boardId, card.position) as { id: string; position: number } | undefined;
    if (!target) return card;
    const now = Date.now();
    this.db.transaction(() => {
      this.db.prepare('UPDATE creator_board_cards SET position = ?, updated_at = ? WHERE id = ?')
        .run(target.position, now, card.id);
      this.db.prepare('UPDATE creator_board_cards SET position = ?, updated_at = ? WHERE id = ?')
        .run(card.position, now, target.id);
    })();
    return this.getBoardCard(card.id);
  }

  selectBoardCard(input: CreatorBoardCardSelectInput): CreatorBoardCardRecord | null {
    const card = this.getBoardCard(input.cardId);
    if (!card) return null;
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO creator_board_selections (board_id, card_id, selected, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(board_id, card_id) DO UPDATE SET selected = excluded.selected, updated_at = excluded.updated_at
    `).run(card.boardId, card.id, input.selected ? 1 : 0, now, now);
    return this.getBoardCard(card.id);
  }

  buildBoardContextPack(input: CreatorBoardContextPackInput): CreatorBoardContextPackResult {
    const board = this.getBoardRow(input.boardId);
    if (!board) {
      throw new Error('Board not found');
    }
    const requested = Array.isArray(input.cardIds) ? new Set(input.cardIds.filter((id) => id.trim())) : null;
    const cards = this.listBoardCards(board.id)
      .filter((card) => requested ? requested.has(card.id) : card.selected);
    if (cards.length === 0) {
      throw new Error('Board selection is empty');
    }
    const brandKit = this.getBrandKit(board.project_id);
    const contextPack = this.renderBoardContextPack(board, cards, brandKit);
    return {
      boardId: board.id,
      cardIds: cards.map((card) => card.id),
      contextPack,
    };
  }

  updateBrandKit(input: CreatorBrandKitUpdateInput): CreatorBoardWorkspaceSnapshot {
    const projectId = input.projectId.trim();
    this.ensureProjectExists(projectId);
    const current = this.getBrandKit(projectId);
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO creator_brand_kits (
        project_id, colors_json, logo_asset_id, logo_path, banned_words_json,
        tone, visual_preferences, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        colors_json = excluded.colors_json,
        logo_asset_id = excluded.logo_asset_id,
        logo_path = excluded.logo_path,
        banned_words_json = excluded.banned_words_json,
        tone = excluded.tone,
        visual_preferences = excluded.visual_preferences,
        updated_at = excluded.updated_at
    `).run(
      projectId,
      JSON.stringify(Array.isArray(input.colors) ? normalizeTags(input.colors) : current.colors),
      input.logoAssetId === undefined ? current.logoAssetId : normalizeOptionalText(input.logoAssetId),
      input.logoPath === undefined ? current.logoPath : normalizeOptionalText(input.logoPath),
      JSON.stringify(Array.isArray(input.bannedWords) ? normalizeTags(input.bannedWords) : current.bannedWords),
      input.tone === undefined ? current.tone : input.tone.trim().slice(0, 240),
      input.visualPreferences === undefined ? current.visualPreferences : input.visualPreferences.trim().slice(0, 1000),
      current.createdAt || now,
      now
    );
    return this.getBoardWorkspace(projectId);
  }

  listCreativeModelCapabilities() {
    return CREATOR_CREATIVE_MODEL_CAPABILITIES;
  }

  createBatchRun(input: CreatorBatchRunCreateInput): CreatorBatchRunRecord {
    const projectId = input.projectId.trim() || this.getCurrentProjectId();
    this.ensureProjectExists(projectId);
    const directions = this.normalizeBatchDirections(input.directions);
    if (directions.length === 0) {
      throw new Error('At least one direction is required');
    }
    const capabilityById = new Map(CREATOR_CREATIVE_MODEL_CAPABILITIES.map((model) => [model.id, model]));
    const models = normalizeTags(input.modelIds)
      .map((modelId) => capabilityById.get(modelId))
      .filter((model): model is typeof CREATOR_CREATIVE_MODEL_CAPABILITIES[number] => Boolean(model));
    if (models.length === 0) {
      throw new Error('At least one creative model is required');
    }
    const unsupportedModel = models.find((model) => !model.supportsBatch);
    if (unsupportedModel) {
      throw new Error(`Model does not support batch: ${unsupportedModel.id}`);
    }
    const templateIds = normalizeTags(input.templateIds).length > 0
      ? normalizeTags(input.templateIds)
      : normalizeTags([input.promptSpec.templateId ?? 'default-template']);
    const sizes = normalizeTags(input.sizes).length > 0
      ? normalizeTags(input.sizes)
      : normalizeTags([String(input.promptSpec.constraints?.aspectRatio ?? '1:1')]);
    const now = Date.now();
    const id = uuidv4();
    const briefTitle = input.briefTitle.trim().slice(0, 120) || 'Creator Batch Run';
    const taskCount = directions.length * models.length * templateIds.length * sizes.length;
    for (const model of models) {
      const modelTaskCount = directions.length * templateIds.length * sizes.length;
      if (modelTaskCount > model.maxBatchTasks) {
        throw new Error(`Batch task count exceeds model limit: ${model.displayName}`);
      }
    }
    const estimatedCostUnits = directions.reduce((total) => total + models.reduce((modelTotal, model) => (
      modelTotal + (model.costUnitEstimate * templateIds.length * sizes.length)
    ), 0), 0);
    const summary: CreatorBatchRunSummary = {
      taskCount,
      modelIds: models.map((model) => model.id),
      modelNames: models.map((model) => model.displayName),
      templateIds,
      sizes,
      estimatedCostUnits,
      costUnitLabel: 'estimated units',
    };
    const rootPromptSpec = ensurePromptSpecV1Snapshot(input.promptSpec, briefTitle);
    const insertTask = this.db.prepare(`
      INSERT INTO creator_batch_tasks (
        id, batch_run_id, project_id, status, direction_id, direction_title,
        model_id, model_name, template_id, size, prompt_spec_json, prompt_text,
        asset_ids_json, error, cost_estimate_text, created_at, updated_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL)
    `);
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO creator_batch_runs (
          id, project_id, status, brief_title, prompt_spec_json, prompt_text,
          summary_json, created_at, updated_at, completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        id,
        projectId,
        CreatorBatchRunStatus.Running,
        briefTitle,
        JSON.stringify(rootPromptSpec),
        input.promptText.trim(),
        JSON.stringify(summary),
        now,
        now
      );
      for (const direction of directions) {
        for (const model of models) {
          for (const templateId of templateIds) {
            for (const size of sizes) {
              const taskId = uuidv4();
              const promptSpec = ensurePromptSpecV1Snapshot({
                ...direction.promptSpec,
                selectedCreativeDirectionId: direction.id,
                selectedCreativeDirection: {
                  id: direction.id,
                  title: direction.title,
                  template: direction.template,
                  style: direction.style,
                  reason: direction.reason,
                  promptFocus: direction.promptFocus,
                },
                templateId,
                constraints: {
                  ...(direction.promptSpec.constraints ?? {}),
                  aspectRatio: size,
                },
                batch: {
                  batchRunId: id,
                  batchTaskId: taskId,
                  modelId: model.id,
                  modelName: model.displayName,
                  outputKinds: model.outputKinds,
                },
              }, direction.title);
              insertTask.run(
                taskId,
                id,
                projectId,
                CreatorBatchTaskStatus.Pending,
                direction.id,
                direction.title,
                model.id,
                model.displayName,
                templateId,
                size,
                JSON.stringify(promptSpec),
                this.renderBatchTaskPrompt({
                  promptText: direction.promptText,
                  promptSpec,
                  batchRunId: id,
                  batchTaskId: taskId,
                  directionId: direction.id,
                  modelName: model.displayName,
                  templateId,
                  size,
                }),
                '[]',
                `${model.costUnitEstimate} ${model.costUnitLabel}`,
                now,
                now
              );
            }
          }
        }
      }
    })();
    return this.getBatchRun(id)!;
  }

  listBatchRuns(input: CreatorBatchRunListInput = {}): CreatorBatchRunListResult {
    const projectId = input.projectId?.trim() || this.getCurrentProjectId();
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 20), 100));
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const rows = this.db.prepare(`
      SELECT id, project_id, status, brief_title, prompt_spec_json, prompt_text,
        summary_json, created_at, updated_at, completed_at
      FROM creator_batch_runs
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(projectId, limit, offset) as BatchRunRow[];
    const totalRow = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM creator_batch_runs
      WHERE project_id = ?
    `).get(projectId) as { count: number };
    return {
      runs: rows.map((row) => this.mapBatchRunRow(row)),
      total: totalRow.count,
    };
  }

  getBatchRun(id: string): CreatorBatchRunRecord | null {
    const row = this.db.prepare(`
      SELECT id, project_id, status, brief_title, prompt_spec_json, prompt_text,
        summary_json, created_at, updated_at, completed_at
      FROM creator_batch_runs
      WHERE id = ?
    `).get(id) as BatchRunRow | undefined;
    return row ? this.mapBatchRunRow(row) : null;
  }

  retryBatchTask(taskId: string): CreatorBatchRunRecord | null {
    const task = this.getBatchTaskRow(taskId);
    if (!task) return null;
    const now = Date.now();
    this.db.prepare(`
      UPDATE creator_batch_tasks
      SET status = ?,
        error = NULL,
        updated_at = ?,
        completed_at = NULL
      WHERE id = ?
    `).run(CreatorBatchTaskStatus.Pending, now, task.id);
    this.updateBatchRunStatus(task.batch_run_id);
    return this.getBatchRun(task.batch_run_id);
  }

  skipBatchTask(taskId: string): CreatorBatchRunRecord | null {
    const task = this.getBatchTaskRow(taskId);
    if (!task) return null;
    const now = Date.now();
    this.db.prepare(`
      UPDATE creator_batch_tasks
      SET status = ?,
        updated_at = ?,
        completed_at = COALESCE(completed_at, ?)
      WHERE id = ?
    `).run(CreatorBatchTaskStatus.Skipped, now, now, task.id);
    this.updateBatchRunStatus(task.batch_run_id);
    return this.getBatchRun(task.batch_run_id);
  }

  failBatchTask(input: CreatorBatchTaskFailInput): CreatorBatchRunRecord | null {
    const task = this.getBatchTaskRow(input.taskId);
    if (!task) return null;
    const now = Date.now();
    this.db.prepare(`
      UPDATE creator_batch_tasks
      SET status = ?,
        error = ?,
        updated_at = ?,
        completed_at = COALESCE(completed_at, ?)
      WHERE id = ?
    `).run(
      CreatorBatchTaskStatus.Failed,
      input.error.trim().slice(0, 1000) || 'Task failed',
      now,
      now,
      task.id
    );
    this.updateBatchRunStatus(task.batch_run_id);
    return this.getBatchRun(task.batch_run_id);
  }

  private ingestGeneratedImages(sessionId: string, message: CoworkMessage): void {
    const images = getGeneratedImages(message.metadata);
    if (images.length === 0) return;
    const run = this.getLatestPendingRunForSession(sessionId) ?? this.createRunFromLatestPrompt(sessionId, message.timestamp);
    const context = this.getImageAssetContextFromRun(run);
    const now = message.timestamp || Date.now();
    const insertAsset = this.db.prepare(`
      INSERT INTO production_assets (
        id, project_id, kind, title, status, source, run_id, source_run_id, variant_of_asset_id, session_id,
        source_session_id, message_id, source_message_id, template_id,
        case_ids, case_ids_json, prompt_spec, prompt_spec_json, prompt_text,
        parent_prompt_asset_id, prompt_version_id, recipe_id, selected_direction_id,
        file_path, file_name, mime_type,
        favorite, adoption_status, tags_json, license_note, usage_note, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, message_id, file_path) DO UPDATE SET
        status = excluded.status,
        run_id = COALESCE(production_assets.run_id, excluded.run_id),
        source_run_id = COALESCE(production_assets.source_run_id, excluded.source_run_id),
        variant_of_asset_id = COALESCE(production_assets.variant_of_asset_id, excluded.variant_of_asset_id),
        source_session_id = COALESCE(production_assets.source_session_id, excluded.source_session_id),
        source_message_id = COALESCE(production_assets.source_message_id, excluded.source_message_id),
        template_id = COALESCE(production_assets.template_id, excluded.template_id),
        case_ids = excluded.case_ids,
        case_ids_json = excluded.case_ids_json,
        prompt_spec = excluded.prompt_spec,
        prompt_spec_json = excluded.prompt_spec_json,
        prompt_text = excluded.prompt_text,
        parent_prompt_asset_id = COALESCE(production_assets.parent_prompt_asset_id, excluded.parent_prompt_asset_id),
        prompt_version_id = COALESCE(production_assets.prompt_version_id, excluded.prompt_version_id),
        recipe_id = COALESCE(production_assets.recipe_id, excluded.recipe_id),
        selected_direction_id = COALESCE(production_assets.selected_direction_id, excluded.selected_direction_id),
        title = excluded.title,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);
    const getAssetId = this.db.prepare(`
      SELECT id
      FROM production_assets
      WHERE session_id = ? AND message_id = ? AND file_path = ?
      LIMIT 1
    `);

    this.db.transaction(() => {
      const outputAssetIds: string[] = [];
      for (const image of images) {
        const filePath = image.path.trim();
        const caseIdsJson = JSON.stringify(context.caseIds);
        const promptSpecJson = context.promptSpec ? JSON.stringify(context.promptSpec) : null;
        insertAsset.run(
          uuidv4(),
          this.getCurrentProjectId(),
          CreatorProductionAssetKind.Image,
          getImageName(image),
          fs.existsSync(filePath) ? CreatorProductionAssetStatus.Ready : CreatorProductionAssetStatus.Missing,
          CreatorProductionAssetSource.CoworkGeneratedImage,
          run?.id ?? null,
          run?.id ?? null,
          context.variantOfAssetId,
          sessionId,
          sessionId,
          message.id,
          message.id,
          context.templateId,
          caseIdsJson,
          caseIdsJson,
          promptSpecJson,
          promptSpecJson,
          context.promptText,
          context.variantOfAssetId,
          context.promptVersionId,
          context.recipeId,
          context.selectedDirectionId,
          filePath,
          getImageName(image),
          image.mimeType || null,
          0,
          CreatorAssetAdoptionStatus.Unset,
          '[]',
          null,
          null,
          JSON.stringify(getGeneratedImageSourceMetadata(image)),
          now,
          now,
        );
        const assetRow = getAssetId.get(sessionId, message.id, filePath) as { id: string } | undefined;
        if (assetRow?.id) {
          outputAssetIds.push(assetRow.id);
        }
      }

      if (run) {
        this.db.prepare(`
          UPDATE production_runs
          SET status = ?,
            output_asset_ids_json = ?,
            updated_at = ?,
            completed_at = COALESCE(completed_at, ?)
          WHERE id = ?
        `).run(CreatorProductionRunStatus.Completed, JSON.stringify(outputAssetIds), now, now, run.id);
        this.completeBatchTaskForRun(run, outputAssetIds, now);
      }
    })();
  }

  private getImageAssetContextFromRun(run: CreatorProductionRunRecord | null): CreatorGeneratedImageContext {
    return run
      ? {
        templateId: run.templateId,
        caseIds: run.caseIds,
        promptSpec: run.promptSpec,
        promptText: run.promptText,
        variantOfAssetId: run.variantOfAssetId,
        promptVersionId: run.promptVersionId,
        recipeId: run.recipeId,
        selectedDirectionId: run.selectedDirectionId,
      }
      : {
        templateId: null,
        caseIds: [],
        promptSpec: null,
        promptText: '',
        variantOfAssetId: null,
        promptVersionId: null,
        recipeId: null,
        selectedDirectionId: null,
      };
  }

  private completeBatchTaskForRun(
    run: CreatorProductionRunRecord,
    outputAssetIds: string[],
    completedAt: number
  ): void {
    const batchRunId = getPromptSpecBatchString(run.promptSpec, 'batchRunId');
    const batchTaskId = getPromptSpecBatchString(run.promptSpec, 'batchTaskId');
    if (!batchRunId || !batchTaskId || outputAssetIds.length === 0) return;
    const task = this.getBatchTaskRow(batchTaskId);
    if (!task || task.batch_run_id !== batchRunId) return;
    const existingAssetIds = parseJsonArray(task.asset_ids_json);
    const nextAssetIds = [...new Set([...existingAssetIds, ...outputAssetIds])];
    this.db.prepare(`
      UPDATE creator_batch_tasks
      SET status = ?,
        asset_ids_json = ?,
        error = NULL,
        updated_at = ?,
        completed_at = COALESCE(completed_at, ?)
      WHERE id = ?
    `).run(
      CreatorBatchTaskStatus.Completed,
      JSON.stringify(nextAssetIds),
      completedAt,
      completedAt,
      batchTaskId
    );
    this.updateBatchRunStatus(batchRunId);
  }

  private createRunFromLatestPrompt(sessionId: string, createdAt: number): CreatorProductionRunRecord | null {
    const row = this.db.prepare(`
      SELECT content, created_at
      FROM cowork_messages
      WHERE session_id = ?
        AND type = 'user'
        AND content LIKE '%[Creator Studio]%'
      ORDER BY COALESCE(sequence, created_at) DESC, created_at DESC
      LIMIT 1
    `).get(sessionId) as { content: string; created_at: number } | undefined;
    if (!row) return null;
    return this.createRunFromPrompt(sessionId, row.content, row.created_at || createdAt);
  }

  private createRun(
    sessionId: string,
    context: CreatorStudioSourceContext,
    createdAt: number
  ): CreatorProductionRunRecord {
    const id = uuidv4();
    const caseIdsJson = JSON.stringify(context.caseIds);
    const promptSpecJson = context.promptSpec ? JSON.stringify(context.promptSpec) : null;
    this.db.prepare(`
      INSERT INTO production_runs (
        id, source, domain, status, session_id, provider, model, agent_id,
        skill_ids_json, runtime_call_id, input_asset_ids_json, output_asset_ids_json,
        template_id, variant_of_asset_id, prompt_version_id, recipe_id, selected_direction_id,
        case_ids, prompt_spec, prompt_text, metadata,
        created_at, updated_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      id,
      CreatorProductionRunSource.CreatorStudio,
      CreatorProductionRunSource.CreatorStudio,
      CreatorProductionRunStatus.Pending,
      sessionId,
      '[]',
      '[]',
      '[]',
      context.templateId,
      context.variantOfAssetId,
      context.promptVersionId,
      context.recipeId,
      context.selectedDirectionId,
      caseIdsJson,
      promptSpecJson,
      context.promptText,
      JSON.stringify({
        sourceTitle: context.sourceTitle,
        batchRunId: context.batchRunId,
        batchTaskId: context.batchTaskId,
      }),
      createdAt,
      createdAt,
    );
    return this.getRun(id)!;
  }

  private getLatestPendingRunForSession(sessionId: string): CreatorProductionRunRecord | null {
    const row = this.db.prepare(`
      SELECT id, source, status, session_id, template_id, variant_of_asset_id, case_ids, prompt_spec,
        prompt_version_id, recipe_id, selected_direction_id, prompt_text, created_at, updated_at, completed_at
      FROM production_runs
      WHERE session_id = ?
        AND status = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(sessionId, CreatorProductionRunStatus.Pending) as ProductionRunRow | undefined;
    return row ? this.mapRunRow(row) : null;
  }

  private getRun(id: string): CreatorProductionRunRecord | null {
    const row = this.db.prepare(`
      SELECT id, source, status, session_id, template_id, variant_of_asset_id, case_ids, prompt_spec,
        prompt_version_id, recipe_id, selected_direction_id, prompt_text, created_at, updated_at, completed_at
      FROM production_runs
      WHERE id = ?
    `).get(id) as ProductionRunRow | undefined;
    return row ? this.mapRunRow(row) : null;
  }

  private ensureDefaultProject(): void {
    const now = Date.now();
    this.db.prepare(`
      INSERT OR IGNORE INTO creator_projects (id, name, description, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?)
    `).run(CreatorStudioDefaultProjectId, 'Default Project', now, now);
    this.db.prepare(`
      INSERT OR IGNORE INTO creator_workspace_state (key, value, updated_at)
      VALUES (?, ?, ?)
    `).run(CreatorWorkspaceStateKey.CurrentProjectId, CreatorStudioDefaultProjectId, now);
  }

  private getCurrentProjectId(): string {
    this.ensureDefaultProject();
    const row = this.db.prepare(`
      SELECT value
      FROM creator_workspace_state
      WHERE key = ?
    `).get(CreatorWorkspaceStateKey.CurrentProjectId) as { value: string } | undefined;
    const projectId = row?.value || CreatorStudioDefaultProjectId;
    const project = this.db.prepare('SELECT id FROM creator_projects WHERE id = ?').get(projectId);
    return project ? projectId : CreatorStudioDefaultProjectId;
  }

  private listProjects(): CreatorWorkspaceSnapshot['projects'] {
    const rows = this.db.prepare(`
      SELECT id, name, description, created_at, updated_at
      FROM creator_projects
      ORDER BY updated_at DESC, created_at DESC
    `).all() as ProjectRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private listCollections(projectId: string): CreatorAssetCollectionRecord[] {
    const rows = this.db.prepare(`
      SELECT
        c.id,
        c.project_id,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        COUNT(ci.asset_id) AS asset_count
      FROM creator_asset_collections c
      LEFT JOIN creator_asset_collection_items ci ON ci.collection_id = c.id
      WHERE c.project_id = ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC, c.created_at DESC
    `).all(projectId) as CollectionRow[];
    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      assetCount: row.asset_count,
    }));
  }

  private ensureProjectExists(projectId: string): void {
    this.ensureDefaultProject();
    const project = this.db.prepare('SELECT id FROM creator_projects WHERE id = ?').get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
  }

  private getCurrentBoardStateKey(projectId: string): string {
    return `${CreatorWorkspaceStateKey.CurrentBoardIdPrefix}:${projectId}`;
  }

  private setCurrentBoardId(projectId: string, boardId: string): void {
    this.db.prepare(`
      INSERT INTO creator_workspace_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(this.getCurrentBoardStateKey(projectId), boardId, Date.now());
  }

  private ensureCurrentBoard(projectId: string): string {
    const currentRow = this.db.prepare(`
      SELECT value
      FROM creator_workspace_state
      WHERE key = ?
    `).get(this.getCurrentBoardStateKey(projectId)) as { value: string } | undefined;
    if (currentRow?.value) {
      const board = this.db.prepare(`
        SELECT id
        FROM creator_boards
        WHERE id = ? AND project_id = ?
      `).get(currentRow.value, projectId) as { id: string } | undefined;
      if (board) return board.id;
    }

    const existing = this.db.prepare(`
      SELECT id
      FROM creator_boards
      WHERE project_id = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `).get(projectId) as { id: string } | undefined;
    if (existing) {
      this.setCurrentBoardId(projectId, existing.id);
      return existing.id;
    }

    const now = Date.now();
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO creator_boards (id, project_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?)
    `).run(id, projectId, 'Creative Board', now, now);
    this.setCurrentBoardId(projectId, id);
    return id;
  }

  private getBoardRow(boardId: string): BoardRow | null {
    const row = this.db.prepare(`
      SELECT id, project_id, name, description, created_at, updated_at
      FROM creator_boards
      WHERE id = ?
    `).get(boardId) as BoardRow | undefined;
    return row ?? null;
  }

  private listBoards(projectId: string): CreatorBoardRecord[] {
    const rows = this.db.prepare(`
      SELECT id, project_id, name, description, created_at, updated_at
      FROM creator_boards
      WHERE project_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `).all(projectId) as BoardRow[];
    return rows.map((row) => this.mapBoardRow(row));
  }

  private getBoardCard(cardId: string): CreatorBoardCardRecord | null {
    const row = this.db.prepare(`
      SELECT
        c.*,
        COALESCE(s.selected, 0) AS selected
      FROM creator_board_cards c
      LEFT JOIN creator_board_selections s ON s.board_id = c.board_id AND s.card_id = c.id
      WHERE c.id = ?
    `).get(cardId) as BoardCardRow | undefined;
    return row ? this.mapBoardCardRow(row) : null;
  }

  private listBoardCards(boardId: string): CreatorBoardCardRecord[] {
    const rows = this.db.prepare(`
      SELECT
        c.*,
        COALESCE(s.selected, 0) AS selected
      FROM creator_board_cards c
      LEFT JOIN creator_board_selections s ON s.board_id = c.board_id AND s.card_id = c.id
      WHERE c.board_id = ?
      ORDER BY c.position ASC, c.created_at ASC
    `).all(boardId) as BoardCardRow[];
    return rows.map((row) => this.mapBoardCardRow(row));
  }

  private listSelectedBoardCardIds(boardId: string): string[] {
    const rows = this.db.prepare(`
      SELECT card_id
      FROM creator_board_selections
      WHERE board_id = ? AND selected = 1
      ORDER BY updated_at DESC
    `).all(boardId) as Array<{ card_id: string }>;
    return rows.map((row) => row.card_id);
  }

  private reindexBoardCards(boardId: string): void {
    const rows = this.db.prepare(`
      SELECT id
      FROM creator_board_cards
      WHERE board_id = ?
      ORDER BY position ASC, created_at ASC
    `).all(boardId) as Array<{ id: string }>;
    const now = Date.now();
    const update = this.db.prepare('UPDATE creator_board_cards SET position = ?, updated_at = ? WHERE id = ?');
    this.db.transaction(() => {
      rows.forEach((row, index) => update.run(index, now, row.id));
    })();
  }

  private getBrandKit(projectId: string): CreatorBrandKitRecord {
    const now = Date.now();
    const row = this.db.prepare(`
      SELECT project_id, colors_json, logo_asset_id, logo_path, banned_words_json,
        tone, visual_preferences, created_at, updated_at
      FROM creator_brand_kits
      WHERE project_id = ?
    `).get(projectId) as BrandKitRow | undefined;
    if (!row) {
      return {
        projectId,
        colors: [],
        logoAssetId: null,
        logoPath: null,
        bannedWords: [],
        tone: '',
        visualPreferences: '',
        createdAt: now,
        updatedAt: now,
      };
    }
    return {
      projectId: row.project_id,
      colors: parseJsonArray(row.colors_json),
      logoAssetId: row.logo_asset_id,
      logoPath: row.logo_path,
      bannedWords: parseJsonArray(row.banned_words_json),
      tone: row.tone ?? '',
      visualPreferences: row.visual_preferences ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private renderBoardContextPack(
    board: BoardRow,
    cards: CreatorBoardCardRecord[],
    brandKit: CreatorBrandKitRecord
  ): string {
    const lines = [
      `Board: ${board.name}`,
      `projectId: ${board.project_id}`,
      '',
      'Brand Kit:',
      `colors: ${brandKit.colors.length > 0 ? brandKit.colors.join(', ') : 'none'}`,
      `logo: ${brandKit.logoPath || brandKit.logoAssetId || 'none'}`,
      `tone: ${brandKit.tone || 'none'}`,
      `visualPreferences: ${brandKit.visualPreferences || 'none'}`,
      `bannedWords: ${brandKit.bannedWords.length > 0 ? brandKit.bannedWords.join(', ') : 'none'}`,
      '',
      'Selected Board Cards:',
    ];
    cards.forEach((card, index) => {
      lines.push(`${index + 1}. kind=${card.kind}; title=${card.title}; group=${card.groupName || 'none'}`);
      if (card.assetId) {
        lines.push(`   assetId=${card.assetId}`);
        const asset = this.getAsset(card.assetId);
        if (asset) {
          lines.push(`   assetKind=${asset.kind}; assetSource=${asset.source}; fileName=${asset.fileName}`);
          lines.push(`   filePath=${asset.filePath}`);
          lines.push(`   assetRole=${card.groupName || asset.kind}`);
          if (asset.templateId) lines.push(`   templateId=${asset.templateId}`);
          if (asset.caseIds.length > 0) lines.push(`   caseIds=${asset.caseIds.join(', ')}`);
          if (asset.tags.length > 0) lines.push(`   tags=${asset.tags.join(', ')}`);
          if (asset.promptText) lines.push(`   assetPrompt=${asset.promptText.slice(0, 1200)}`);
        }
      }
      if (card.caseId) lines.push(`   caseId=${card.caseId}`);
      if (card.notes) lines.push(`   notes=${card.notes}`);
      if (card.direction) {
        lines.push(`   direction=${card.direction.title}; template=${card.direction.template}; style=${card.direction.style}; reason=${card.direction.reason}; focus=${card.direction.promptFocus}`);
      }
      if (card.promptText) lines.push(`   prompt=${card.promptText.slice(0, 1200)}`);
    });
    return lines.join('\n');
  }

  private getAssetCollectionIds(assetId: string): string[] {
    const rows = this.db.prepare(`
      SELECT collection_id
      FROM creator_asset_collection_items
      WHERE asset_id = ?
      ORDER BY added_at DESC
    `).all(assetId) as Array<{ collection_id: string }>;
    return rows.map((row) => row.collection_id);
  }

  private isAssetSelected(projectId: string, assetId: string): boolean {
    const row = this.db.prepare(`
      SELECT status
      FROM creator_asset_selections
      WHERE project_id = ? AND asset_id = ?
    `).get(projectId, assetId) as { status: string } | undefined;
    return row?.status === CreatorAssetSelectionStatus.Selected;
  }

  private normalizeBatchDirections(directions: CreatorBatchDirectionInput[]): CreatorBatchDirectionInput[] {
    if (!Array.isArray(directions)) return [];
    const normalized: CreatorBatchDirectionInput[] = [];
    for (const direction of directions) {
      const id = direction.id?.trim();
      const title = direction.title?.trim();
      const promptText = direction.promptText?.trim();
      if (!id || !title || !promptText || !direction.promptSpec) continue;
      normalized.push({
        id: id.slice(0, 80),
        title: title.slice(0, 120),
        template: (direction.template ?? '').trim().slice(0, 240),
        style: (direction.style ?? '').trim().slice(0, 240),
        reason: (direction.reason ?? '').trim().slice(0, 500),
        promptFocus: (direction.promptFocus ?? '').trim().slice(0, 500),
        promptText,
        promptSpec: direction.promptSpec,
      });
    }
    return normalized.slice(0, 6);
  }

  private renderBatchTaskPrompt(input: {
    promptText: string;
    promptSpec: CreatorPromptSpecSnapshot;
    batchRunId: string;
    batchTaskId: string;
    directionId: string;
    modelName: string;
    templateId: string;
    size: string;
  }): string {
    return [
      CREATOR_STUDIO_MARKER,
      '',
      `batchRunId: ${input.batchRunId}`,
      `batchTaskId: ${input.batchTaskId}`,
      `directionId: ${input.directionId}`,
      `templateId: ${input.templateId}`,
      `size: ${input.size}`,
      `model: ${input.modelName}`,
      '',
      'PromptSpec:',
      '```json',
      JSON.stringify(input.promptSpec, null, 2),
      '```',
      '',
      'Prompt:',
      '```text',
      [
        input.promptText.trim(),
        '',
        'Batch execution constraints:',
        `model=${input.modelName}`,
        `templateId=${input.templateId}`,
        `size=${input.size}`,
      ].join('\n'),
      '```',
    ].join('\n');
  }

  private getBatchTaskRow(taskId: string): BatchTaskRow | null {
    const row = this.db.prepare(`
      SELECT id, batch_run_id, project_id, status, direction_id, direction_title,
        model_id, model_name, template_id, size, prompt_spec_json, prompt_text,
        asset_ids_json, error, cost_estimate_text, created_at, updated_at, completed_at
      FROM creator_batch_tasks
      WHERE id = ?
    `).get(taskId) as BatchTaskRow | undefined;
    return row ?? null;
  }

  private listBatchTasks(batchRunId: string): CreatorBatchTaskRecord[] {
    const rows = this.db.prepare(`
      SELECT id, batch_run_id, project_id, status, direction_id, direction_title,
        model_id, model_name, template_id, size, prompt_spec_json, prompt_text,
        asset_ids_json, error, cost_estimate_text, created_at, updated_at, completed_at
      FROM creator_batch_tasks
      WHERE batch_run_id = ?
      ORDER BY direction_id ASC, model_name ASC, template_id ASC, size ASC, created_at ASC
    `).all(batchRunId) as BatchTaskRow[];
    return rows.map((row) => this.mapBatchTaskRow(row));
  }

  private updateBatchRunStatus(batchRunId: string): void {
    const tasks = this.listBatchTasks(batchRunId);
    if (tasks.length === 0) return;
    const hasActive = tasks.some((task) => (
      task.status === CreatorBatchTaskStatus.Pending
      || task.status === CreatorBatchTaskStatus.Running
    ));
    const hasFailed = tasks.some((task) => task.status === CreatorBatchTaskStatus.Failed);
    const hasSkipped = tasks.some((task) => task.status === CreatorBatchTaskStatus.Skipped);
    const hasCompleted = tasks.some((task) => task.status === CreatorBatchTaskStatus.Completed);
    const nextStatus = hasActive
      ? CreatorBatchRunStatus.Running
      : hasFailed || hasSkipped
        ? hasCompleted
          ? CreatorBatchRunStatus.PartialFailed
          : CreatorBatchRunStatus.Failed
        : CreatorBatchRunStatus.Completed;
    const now = Date.now();
    this.db.prepare(`
      UPDATE creator_batch_runs
      SET status = ?,
        updated_at = ?,
        completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, ?) ELSE NULL END
      WHERE id = ?
    `).run(nextStatus, now, hasActive ? 0 : 1, now, batchRunId);
  }

  private mapBatchRunRow(row: BatchRunRow): CreatorBatchRunRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      status: row.status as CreatorBatchRunStatus,
      briefTitle: row.brief_title,
      promptSpec: parsePromptSpec(row.prompt_spec_json) ?? {},
      promptText: row.prompt_text,
      summary: parseBatchSummary(row.summary_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      tasks: this.listBatchTasks(row.id),
    };
  }

  private mapBatchTaskRow(row: BatchTaskRow): CreatorBatchTaskRecord {
    return {
      id: row.id,
      batchRunId: row.batch_run_id,
      projectId: row.project_id,
      status: row.status as CreatorBatchTaskStatus,
      directionId: row.direction_id,
      directionTitle: row.direction_title,
      modelId: row.model_id,
      modelName: row.model_name,
      templateId: row.template_id,
      size: row.size,
      promptSpec: parsePromptSpec(row.prompt_spec_json) ?? {},
      promptText: row.prompt_text,
      assetIds: parseJsonArray(row.asset_ids_json),
      error: row.error,
      costEstimateText: row.cost_estimate_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  private mapRecipeRow(row: RecipeRow): CreatorRecipeRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      sourcePromptAssetId: row.source_prompt_asset_id,
      promptSpec: parsePromptSpec(row.prompt_spec_json) ?? {},
      defaultRuntime: parseJsonObject(row.default_runtime_json),
      defaultOutput: parseJsonObject(row.default_output_json),
      tags: parseJsonArray(row.tags_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapPromptVersionRow(row: PromptVersionRow): CreatorPromptVersionRecord {
    return {
      id: row.id,
      promptAssetId: row.prompt_asset_id,
      version: row.version,
      promptText: row.prompt_text,
      promptSpec: parsePromptSpec(row.prompt_spec_json) ?? {},
      changeNote: row.change_note,
      createdAt: row.created_at,
    };
  }

  private mapRunRow(row: ProductionRunRow): CreatorProductionRunRecord {
    return {
      id: row.id,
      source: row.source as CreatorProductionRunSource,
      status: row.status as CreatorProductionRunStatus,
      sessionId: row.session_id,
      templateId: row.template_id,
      caseIds: parseJsonArray(row.case_ids),
      promptSpec: parsePromptSpec(row.prompt_spec),
      promptText: row.prompt_text,
      variantOfAssetId: row.variant_of_asset_id,
      promptVersionId: row.prompt_version_id,
      recipeId: row.recipe_id,
      selectedDirectionId: row.selected_direction_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  private mapBoardRow(row: BoardRow): CreatorBoardRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapBoardCardRow(row: BoardCardRow): CreatorBoardCardRecord {
    return {
      id: row.id,
      boardId: row.board_id,
      projectId: row.project_id,
      kind: row.kind as CreatorBoardCardKind,
      title: row.title,
      assetId: row.asset_id,
      caseId: row.case_id,
      promptText: row.prompt_text,
      promptSpec: parsePromptSpec(row.prompt_spec_json),
      direction: parseDirection(row.direction_json),
      groupName: row.group_name,
      notes: row.notes,
      position: row.position,
      selected: Boolean(row.selected),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapImageProcessingPlanRow(row: ImageProcessingPlanRow): CreatorImageProcessingPlan | null {
    const plan = parseImageProcessingPlanJson(row.plan_json);
    if (!plan) return null;
    return {
      ...plan,
      status: isCreatorImageProcessingPlanStatus(row.status) ? row.status : CreatorImageProcessingPlanStatus.Failed,
      updatedAt: row.updated_at,
    };
  }

  private mapImageProcessingJobRow(row: ImageProcessingJobRow): CreatorImageProcessingJob {
    const metadata = parseJsonObject(row.metadata_json);
    return {
      id: row.id,
      projectId: row.project_id,
      planId: row.plan_id,
      status: isCreatorImageProcessingJobStatus(row.status) ? row.status : CreatorImageProcessingJobStatus.Failed,
      totalCount: row.total_count,
      successCount: row.success_count,
      failedCount: row.failed_count,
      inputTotalSize: row.input_total_size,
      outputTotalSize: row.output_total_size,
      savedSize: row.saved_size,
      savedPercentage: typeof metadata.savedPercentage === 'number'
        ? metadata.savedPercentage
        : row.input_total_size > 0
          ? Math.round((row.saved_size / row.input_total_size) * 10000) / 100
          : 0,
      runtimeMetrics: parseImageProcessingRuntimeMetrics(metadata.runtimeMetrics),
      reportAssetId: row.report_asset_id,
      reportPath: typeof metadata.reportPath === 'string' ? metadata.reportPath : null,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  private mapImageProcessingTaskRow(row: ImageProcessingTaskRow): CreatorImageProcessingTask {
    return {
      id: row.id,
      jobId: row.job_id,
      projectId: row.project_id,
      sourceAssetId: row.source_asset_id,
      outputAssetId: row.output_asset_id,
      sourceArtifactId: row.source_artifact_id,
      sourcePath: row.source_path,
      outputPath: row.output_path,
      status: isCreatorImageProcessingTaskStatus(row.status) ? row.status : CreatorImageProcessingTaskStatus.Failed,
      inputSize: row.input_size,
      outputSize: row.output_size,
      durationMs: row.duration_ms,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  private listImageProcessingTasks(jobId: string): CreatorImageProcessingTask[] {
    const rows = this.db.prepare(`
      SELECT * FROM creator_image_processing_tasks
      WHERE job_id = ?
      ORDER BY created_at ASC
    `).all(jobId) as ImageProcessingTaskRow[];
    return rows.map((row) => this.mapImageProcessingTaskRow(row));
  }

  private mapAssetRow(row: ProductionAssetRow): CreatorProductionAssetRecord {
    const metadata = parseJsonObject(row.metadata);
    const imageSource = parseCreatorImageSourceFile(metadata, row.file_path);
    const exists = fs.existsSync(row.file_path);
    const hasResolvableImageSource = Boolean(
      imageSource?.originalUrl
      || (imageSource?.originalPath && fs.existsSync(imageSource.originalPath))
      || (imageSource?.localPath && fs.existsSync(imageSource.localPath))
    );
    const projectId = row.project_id || CreatorStudioDefaultProjectId;
    const adoptionStatus = isAdoptionStatus(row.adoption_status)
      ? row.adoption_status
      : CreatorAssetAdoptionStatus.Unset;
    const isFileBackedImage = row.kind === CreatorProductionAssetKind.Image;
    return {
      id: row.id,
      projectId,
      kind: row.kind as CreatorProductionAssetKind,
      status: !isFileBackedImage || exists
        ? row.status as CreatorProductionAssetStatus
        : hasResolvableImageSource
          ? CreatorProductionAssetStatus.Ready
          : CreatorProductionAssetStatus.Missing,
      source: row.source as CreatorProductionAssetSource,
      runId: row.source_run_id ?? row.run_id,
      variantOfAssetId: row.variant_of_asset_id,
      sessionId: row.source_session_id ?? row.session_id,
      messageId: row.source_message_id ?? row.message_id,
      templateId: row.template_id,
      caseIds: parseJsonArray(row.case_ids_json ?? row.case_ids),
      promptSpec: parsePromptSpec(row.prompt_spec_json ?? row.prompt_spec),
      promptText: row.prompt_text,
      parentPromptAssetId: row.parent_prompt_asset_id,
      promptVersionId: row.prompt_version_id,
      recipeId: row.recipe_id,
      selectedDirectionId: row.selected_direction_id,
      filePath: row.file_path,
      fileName: row.file_name,
      mimeType: row.mime_type,
      favorite: Boolean(row.favorite),
      adoptionStatus,
      tags: parseJsonArray(row.tags_json),
      collectionIds: this.getAssetCollectionIds(row.id),
      selected: this.isAssetSelected(projectId, row.id),
      licenseNote: row.license_note,
      usageNote: row.usage_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sourceSessionAvailable: Boolean(row.source_session_available),
      imageSource,
      imageMetadata: parseImageMetadata(metadata),
      imageProcessing: parseImageProcessingMetadata(metadata),
    };
  }
}
