export const CreatorStudioIpcChannel = {
  AssetList: 'creatorStudio:asset:list',
  AssetGetSource: 'creatorStudio:asset:getSource',
  AssetSetFavorite: 'creatorStudio:asset:setFavorite',
  AssetUpdate: 'creatorStudio:asset:update',
  AssetCreatePrompt: 'creatorStudio:asset:createPrompt',
  AssetCreateCase: 'creatorStudio:asset:createCase',
  AssetRevealInFolder: 'creatorStudio:asset:revealInFolder',
  RecipeCreate: 'creatorStudio:recipe:create',
  RecipeList: 'creatorStudio:recipe:list',
  RecipeImport: 'creatorStudio:recipe:import',
  PromptVersionCreate: 'creatorStudio:promptVersion:create',
  PromptVersionList: 'creatorStudio:promptVersion:list',
  PromptVersionFork: 'creatorStudio:promptVersion:fork',
  PromptVersionDiff: 'creatorStudio:promptVersion:diff',
  WorkspaceGet: 'creatorStudio:workspace:get',
  ProjectCreate: 'creatorStudio:project:create',
  ProjectSetCurrent: 'creatorStudio:project:setCurrent',
  CollectionCreate: 'creatorStudio:collection:create',
  CollectionAddAsset: 'creatorStudio:collection:addAsset',
  BoardWorkspaceGet: 'creatorStudio:board:workspace:get',
  BoardCreate: 'creatorStudio:board:create',
  BoardSetCurrent: 'creatorStudio:board:setCurrent',
  BoardCardAdd: 'creatorStudio:board:card:add',
  BoardCardUpdate: 'creatorStudio:board:card:update',
  BoardCardRemove: 'creatorStudio:board:card:remove',
  BoardCardMove: 'creatorStudio:board:card:move',
  BoardCardSelect: 'creatorStudio:board:card:select',
  BoardBuildContextPack: 'creatorStudio:board:contextPack:build',
  BrandKitUpdate: 'creatorStudio:brandKit:update',
  ModelCapabilityList: 'creatorStudio:modelCapability:list',
  BatchRunCreate: 'creatorStudio:batchRun:create',
  BatchRunList: 'creatorStudio:batchRun:list',
  BatchRunGet: 'creatorStudio:batchRun:get',
  BatchTaskRetry: 'creatorStudio:batchTask:retry',
  BatchTaskSkip: 'creatorStudio:batchTask:skip',
  BatchTaskFail: 'creatorStudio:batchTask:fail',
  ImageInspect: 'creatorStudio:image:inspect',
  ImagePlanCreate: 'creatorStudio:imagePlan:create',
  ImagePlanGet: 'creatorStudio:imagePlan:get',
  ImageJobExecute: 'creatorStudio:imageJob:execute',
  ImageJobGet: 'creatorStudio:imageJob:get',
  ImageJobList: 'creatorStudio:imageJob:list',
  ImageBatchCreate: 'creatorStudio:imageBatch:create',
  ImageRecipeExecute: 'creatorStudio:imageRecipe:execute',
  ImageTaskRetry: 'creatorStudio:imageTask:retry',
  ImageTaskCancel: 'creatorStudio:imageTask:cancel',
  ImageOutputReveal: 'creatorStudio:imageOutput:reveal',
  ImageReportOpen: 'creatorStudio:imageReport:open',
} as const;

export type CreatorStudioIpcChannel =
  typeof CreatorStudioIpcChannel[keyof typeof CreatorStudioIpcChannel];

export const CreatorPromptSpecSchemaVersion = {
  V1: 'creator.prompt.v1',
} as const;

export type CreatorPromptSpecSchemaVersion =
  typeof CreatorPromptSpecSchemaVersion[keyof typeof CreatorPromptSpecSchemaVersion];

export const CreatorFeatureFlag = {
  ImageProcessingEnabled: 'creator.imageProcessing.enabled',
} as const;

export type CreatorFeatureFlag =
  typeof CreatorFeatureFlag[keyof typeof CreatorFeatureFlag];

export const CreatorFeatureFlagValues = [
  CreatorFeatureFlag.ImageProcessingEnabled,
] as const;

export const CreatorFeatureFlagDefaults: Record<CreatorFeatureFlag, boolean> = {
  [CreatorFeatureFlag.ImageProcessingEnabled]: true,
};

export type CreatorFeatureFlagConfig = Partial<Record<CreatorFeatureFlag, boolean>>;

export const CreatorProductionAssetKind = {
  Image: 'image',
  Prompt: 'prompt',
  Case: 'case',
  Report: 'report',
} as const;

export type CreatorProductionAssetKind =
  typeof CreatorProductionAssetKind[keyof typeof CreatorProductionAssetKind];

export const CreatorProductionAssetKindValues = [
  CreatorProductionAssetKind.Image,
  CreatorProductionAssetKind.Prompt,
  CreatorProductionAssetKind.Case,
  CreatorProductionAssetKind.Report,
] as const;

export const CreatorProductionAssetStatus = {
  Ready: 'ready',
  Missing: 'missing',
} as const;

export type CreatorProductionAssetStatus =
  typeof CreatorProductionAssetStatus[keyof typeof CreatorProductionAssetStatus];

export const CreatorProductionAssetStatusValues = [
  CreatorProductionAssetStatus.Ready,
  CreatorProductionAssetStatus.Missing,
] as const;

export const CreatorProductionAssetSource = {
  CoworkGeneratedImage: 'cowork_generated_image',
  CreatorPrompt: 'creator_prompt',
  CreatorCase: 'creator_case',
  LocalImageProcessing: 'local_image_processing',
  ImageProcessingReport: 'image_processing_report',
  RecipePostProcessing: 'recipe_post_processing',
} as const;

export type CreatorProductionAssetSource =
  typeof CreatorProductionAssetSource[keyof typeof CreatorProductionAssetSource];

export const CreatorProductionAssetSourceValues = [
  CreatorProductionAssetSource.CoworkGeneratedImage,
  CreatorProductionAssetSource.CreatorPrompt,
  CreatorProductionAssetSource.CreatorCase,
  CreatorProductionAssetSource.LocalImageProcessing,
  CreatorProductionAssetSource.ImageProcessingReport,
  CreatorProductionAssetSource.RecipePostProcessing,
] as const;

export const CreatorProductionRunStatus = {
  Pending: 'pending',
  Completed: 'completed',
  Failed: 'failed',
} as const;

export type CreatorProductionRunStatus =
  typeof CreatorProductionRunStatus[keyof typeof CreatorProductionRunStatus];

export const CreatorProductionRunStatusValues = [
  CreatorProductionRunStatus.Pending,
  CreatorProductionRunStatus.Completed,
  CreatorProductionRunStatus.Failed,
] as const;

export const CreatorProductionRunSource = {
  CreatorStudio: 'creator_studio',
} as const;

export type CreatorProductionRunSource =
  typeof CreatorProductionRunSource[keyof typeof CreatorProductionRunSource];

export const CreatorProductionRunSourceValues = [
  CreatorProductionRunSource.CreatorStudio,
] as const;

export const CreatorAssetAdoptionStatus = {
  Unset: 'unset',
  Favorite: 'favorite',
  Shortlisted: 'shortlisted',
  Adopted: 'adopted',
  Rejected: 'rejected',
} as const;

export type CreatorAssetAdoptionStatus =
  typeof CreatorAssetAdoptionStatus[keyof typeof CreatorAssetAdoptionStatus];

export const CreatorAssetAdoptionStatusValues = [
  CreatorAssetAdoptionStatus.Unset,
  CreatorAssetAdoptionStatus.Favorite,
  CreatorAssetAdoptionStatus.Shortlisted,
  CreatorAssetAdoptionStatus.Adopted,
  CreatorAssetAdoptionStatus.Rejected,
] as const;

export const CreatorAssetSelectionStatus = {
  Selected: 'selected',
  Unselected: 'unselected',
} as const;

export type CreatorAssetSelectionStatus =
  typeof CreatorAssetSelectionStatus[keyof typeof CreatorAssetSelectionStatus];

export const CreatorAssetSelectionStatusValues = [
  CreatorAssetSelectionStatus.Selected,
  CreatorAssetSelectionStatus.Unselected,
] as const;

export const CreatorBoardCardKind = {
  Asset: 'asset',
  Case: 'case',
  Prompt: 'prompt',
  Direction: 'direction',
} as const;

export type CreatorBoardCardKind =
  typeof CreatorBoardCardKind[keyof typeof CreatorBoardCardKind];

export const CreatorBoardCardKindValues = [
  CreatorBoardCardKind.Asset,
  CreatorBoardCardKind.Case,
  CreatorBoardCardKind.Prompt,
  CreatorBoardCardKind.Direction,
] as const;

export const CreatorBoardMoveDirection = {
  Up: 'up',
  Down: 'down',
} as const;

export type CreatorBoardMoveDirection =
  typeof CreatorBoardMoveDirection[keyof typeof CreatorBoardMoveDirection];

export const CreatorBoardMoveDirectionValues = [
  CreatorBoardMoveDirection.Up,
  CreatorBoardMoveDirection.Down,
] as const;

export const CreatorCreativeModelOutputKind = {
  Image: 'image',
  Video: 'video',
  Text: 'text',
} as const;

export type CreatorCreativeModelOutputKind =
  typeof CreatorCreativeModelOutputKind[keyof typeof CreatorCreativeModelOutputKind];

export const CreatorCreativeModelOutputKindValues = [
  CreatorCreativeModelOutputKind.Image,
  CreatorCreativeModelOutputKind.Video,
  CreatorCreativeModelOutputKind.Text,
] as const;

export const CreatorBatchRunKind = {
  CreativeGeneration: 'creative_generation',
  ImageProcessing: 'image_processing',
} as const;

export type CreatorBatchRunKind =
  typeof CreatorBatchRunKind[keyof typeof CreatorBatchRunKind];

export const CreatorBatchRunKindValues = [
  CreatorBatchRunKind.CreativeGeneration,
  CreatorBatchRunKind.ImageProcessing,
] as const;

export const CreatorBatchRunStatus = {
  Running: 'running',
  Completed: 'completed',
  PartialFailed: 'partial_failed',
  Failed: 'failed',
} as const;

export type CreatorBatchRunStatus =
  typeof CreatorBatchRunStatus[keyof typeof CreatorBatchRunStatus];

export const CreatorBatchRunStatusValues = [
  CreatorBatchRunStatus.Running,
  CreatorBatchRunStatus.Completed,
  CreatorBatchRunStatus.PartialFailed,
  CreatorBatchRunStatus.Failed,
] as const;

export const CreatorBatchTaskStatus = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Skipped: 'skipped',
} as const;

export type CreatorBatchTaskStatus =
  typeof CreatorBatchTaskStatus[keyof typeof CreatorBatchTaskStatus];

export const CreatorBatchTaskStatusValues = [
  CreatorBatchTaskStatus.Pending,
  CreatorBatchTaskStatus.Running,
  CreatorBatchTaskStatus.Completed,
  CreatorBatchTaskStatus.Failed,
  CreatorBatchTaskStatus.Skipped,
] as const;

export const CreatorImageMetadataStatus = {
  Ready: 'ready',
  Unsupported: 'unsupported',
  Corrupt: 'corrupt',
  Missing: 'missing',
} as const;

export type CreatorImageMetadataStatus =
  typeof CreatorImageMetadataStatus[keyof typeof CreatorImageMetadataStatus];

export const CreatorImageMetadataStatusValues = [
  CreatorImageMetadataStatus.Ready,
  CreatorImageMetadataStatus.Unsupported,
  CreatorImageMetadataStatus.Corrupt,
  CreatorImageMetadataStatus.Missing,
] as const;

export const CreatorImageProcessingSourceKind = {
  CreatorAsset: 'creator_asset',
  CoworkGeneratedImage: 'cowork_generated_image',
  ActivityArtifact: 'activity_artifact',
  LocalFile: 'local_file',
} as const;

export type CreatorImageProcessingSourceKind =
  typeof CreatorImageProcessingSourceKind[keyof typeof CreatorImageProcessingSourceKind];

export const CreatorImageProcessingSourceKindValues = [
  CreatorImageProcessingSourceKind.CreatorAsset,
  CreatorImageProcessingSourceKind.CoworkGeneratedImage,
  CreatorImageProcessingSourceKind.ActivityArtifact,
  CreatorImageProcessingSourceKind.LocalFile,
] as const;

export const CreatorImageProcessingPlanStatus = {
  Draft: 'draft',
  Ready: 'ready',
  Executing: 'executing',
  Completed: 'completed',
  Failed: 'failed',
  Canceled: 'canceled',
} as const;

export type CreatorImageProcessingPlanStatus =
  typeof CreatorImageProcessingPlanStatus[keyof typeof CreatorImageProcessingPlanStatus];

export const CreatorImageProcessingPlanStatusValues = [
  CreatorImageProcessingPlanStatus.Draft,
  CreatorImageProcessingPlanStatus.Ready,
  CreatorImageProcessingPlanStatus.Executing,
  CreatorImageProcessingPlanStatus.Completed,
  CreatorImageProcessingPlanStatus.Failed,
  CreatorImageProcessingPlanStatus.Canceled,
] as const;

export const CreatorImageProcessingJobStatus = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  PartialFailed: 'partial_failed',
  Failed: 'failed',
  Canceled: 'canceled',
} as const;

export type CreatorImageProcessingJobStatus =
  typeof CreatorImageProcessingJobStatus[keyof typeof CreatorImageProcessingJobStatus];

export const CreatorImageProcessingJobStatusValues = [
  CreatorImageProcessingJobStatus.Pending,
  CreatorImageProcessingJobStatus.Running,
  CreatorImageProcessingJobStatus.Completed,
  CreatorImageProcessingJobStatus.PartialFailed,
  CreatorImageProcessingJobStatus.Failed,
  CreatorImageProcessingJobStatus.Canceled,
] as const;

export const CreatorImageProcessingTaskStatus = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Skipped: 'skipped',
  Canceled: 'canceled',
} as const;

export type CreatorImageProcessingTaskStatus =
  typeof CreatorImageProcessingTaskStatus[keyof typeof CreatorImageProcessingTaskStatus];

export const CreatorImageProcessingTaskStatusValues = [
  CreatorImageProcessingTaskStatus.Pending,
  CreatorImageProcessingTaskStatus.Running,
  CreatorImageProcessingTaskStatus.Completed,
  CreatorImageProcessingTaskStatus.Failed,
  CreatorImageProcessingTaskStatus.Skipped,
  CreatorImageProcessingTaskStatus.Canceled,
] as const;

export const CreatorImageProcessingOperation = {
  AutoOrient: 'auto_orient',
  Resize: 'resize',
  Crop: 'crop',
  Rotate: 'rotate',
  Convert: 'convert',
  Compress: 'compress',
} as const;

export type CreatorImageProcessingOperation =
  typeof CreatorImageProcessingOperation[keyof typeof CreatorImageProcessingOperation];

export const CreatorImageProcessingOperationValues = [
  CreatorImageProcessingOperation.AutoOrient,
  CreatorImageProcessingOperation.Resize,
  CreatorImageProcessingOperation.Crop,
  CreatorImageProcessingOperation.Rotate,
  CreatorImageProcessingOperation.Convert,
  CreatorImageProcessingOperation.Compress,
] as const;

export const CreatorImageProcessingOutputFormat = {
  Png: 'png',
  Jpeg: 'jpeg',
  Webp: 'webp',
  Avif: 'avif',
} as const;

export type CreatorImageProcessingOutputFormat =
  typeof CreatorImageProcessingOutputFormat[keyof typeof CreatorImageProcessingOutputFormat];

export const CreatorImageProcessingOutputFormatValues = [
  CreatorImageProcessingOutputFormat.Png,
  CreatorImageProcessingOutputFormat.Jpeg,
  CreatorImageProcessingOutputFormat.Webp,
  CreatorImageProcessingOutputFormat.Avif,
] as const;

export const CreatorImageProcessingPlanSchemaVersion = {
  V1: 'creator.imageProcessingPlan.v1',
} as const;

export type CreatorImageProcessingPlanSchemaVersion =
  typeof CreatorImageProcessingPlanSchemaVersion[keyof typeof CreatorImageProcessingPlanSchemaVersion];

export const CreatorImageProcessingPlanSchemaVersionValues = [
  CreatorImageProcessingPlanSchemaVersion.V1,
] as const;

export const CreatorImageProcessingRisk = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const;

export type CreatorImageProcessingRisk =
  typeof CreatorImageProcessingRisk[keyof typeof CreatorImageProcessingRisk];

export const CreatorImageProcessingRiskValues = [
  CreatorImageProcessingRisk.Low,
  CreatorImageProcessingRisk.Medium,
  CreatorImageProcessingRisk.High,
] as const;

export const CreatorImageProcessingCreatedBy = {
  User: 'user',
  Agent: 'agent',
  Recipe: 'recipe',
} as const;

export type CreatorImageProcessingCreatedBy =
  typeof CreatorImageProcessingCreatedBy[keyof typeof CreatorImageProcessingCreatedBy];

export const CreatorImageProcessingCreatedByValues = [
  CreatorImageProcessingCreatedBy.User,
  CreatorImageProcessingCreatedBy.Agent,
  CreatorImageProcessingCreatedBy.Recipe,
] as const;

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

export const CreatorRecipeOutputKind = {
  ImageProcessing: 'image_processing',
} as const;

export type CreatorRecipeOutputKind =
  typeof CreatorRecipeOutputKind[keyof typeof CreatorRecipeOutputKind];

export const CreatorRecipeOutputKindValues = [
  CreatorRecipeOutputKind.ImageProcessing,
] as const;

export const CreatorRecipeImageProcessingPackKind = {
  ReadmeBannerPack: 'readme_banner_pack',
  SocialMediaPack: 'social_media_pack',
} as const;

export type CreatorRecipeImageProcessingPackKind =
  typeof CreatorRecipeImageProcessingPackKind[keyof typeof CreatorRecipeImageProcessingPackKind];

export const CreatorRecipeImageProcessingPackKindValues = [
  CreatorRecipeImageProcessingPackKind.ReadmeBannerPack,
  CreatorRecipeImageProcessingPackKind.SocialMediaPack,
] as const;

export const CreatorRecipeOutputSchemaVersion = {
  ImageProcessingV1: 'creator.recipe.imageProcessingOutput.v1',
} as const;

export type CreatorRecipeOutputSchemaVersion =
  typeof CreatorRecipeOutputSchemaVersion[keyof typeof CreatorRecipeOutputSchemaVersion];

export const CreatorRecipeOutputSchemaVersionValues = [
  CreatorRecipeOutputSchemaVersion.ImageProcessingV1,
] as const;

export const CreatorStudioDefaultProjectId = 'creator-project-default';

export const CreatorStudioAssetListDefaultLimit = 60;
export const CreatorStudioAssetListMaxLimit = 200;

export const isCreatorFeatureFlag = (value: unknown): value is CreatorFeatureFlag => (
  typeof value === 'string'
  && CreatorFeatureFlagValues.includes(value as CreatorFeatureFlag)
);

export const resolveCreatorFeatureFlag = (
  flags: unknown,
  flag: CreatorFeatureFlag,
): boolean => {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return CreatorFeatureFlagDefaults[flag];
  }

  const value = (flags as Partial<Record<CreatorFeatureFlag, unknown>>)[flag];
  return typeof value === 'boolean' ? value : CreatorFeatureFlagDefaults[flag];
};

export const isCreatorProductionAssetKind = (value: unknown): value is CreatorProductionAssetKind => (
  typeof value === 'string'
  && CreatorProductionAssetKindValues.includes(value as CreatorProductionAssetKind)
);

export const isCreatorProductionAssetStatus = (value: unknown): value is CreatorProductionAssetStatus => (
  typeof value === 'string'
  && CreatorProductionAssetStatusValues.includes(value as CreatorProductionAssetStatus)
);

export const isCreatorProductionAssetSource = (value: unknown): value is CreatorProductionAssetSource => (
  typeof value === 'string'
  && CreatorProductionAssetSourceValues.includes(value as CreatorProductionAssetSource)
);

export const isCreatorProductionRunStatus = (value: unknown): value is CreatorProductionRunStatus => (
  typeof value === 'string'
  && CreatorProductionRunStatusValues.includes(value as CreatorProductionRunStatus)
);

export const isCreatorProductionRunSource = (value: unknown): value is CreatorProductionRunSource => (
  typeof value === 'string'
  && CreatorProductionRunSourceValues.includes(value as CreatorProductionRunSource)
);

export const isCreatorBatchRunKind = (value: unknown): value is CreatorBatchRunKind => (
  typeof value === 'string'
  && CreatorBatchRunKindValues.includes(value as CreatorBatchRunKind)
);

export const isCreatorImageMetadataStatus = (value: unknown): value is CreatorImageMetadataStatus => (
  typeof value === 'string'
  && CreatorImageMetadataStatusValues.includes(value as CreatorImageMetadataStatus)
);

export const isCreatorImageProcessingSourceKind = (
  value: unknown,
): value is CreatorImageProcessingSourceKind => (
  typeof value === 'string'
  && CreatorImageProcessingSourceKindValues.includes(value as CreatorImageProcessingSourceKind)
);

export const isCreatorImageProcessingPlanStatus = (
  value: unknown,
): value is CreatorImageProcessingPlanStatus => (
  typeof value === 'string'
  && CreatorImageProcessingPlanStatusValues.includes(value as CreatorImageProcessingPlanStatus)
);

export const isCreatorImageProcessingJobStatus = (
  value: unknown,
): value is CreatorImageProcessingJobStatus => (
  typeof value === 'string'
  && CreatorImageProcessingJobStatusValues.includes(value as CreatorImageProcessingJobStatus)
);

export const isCreatorImageProcessingTaskStatus = (
  value: unknown,
): value is CreatorImageProcessingTaskStatus => (
  typeof value === 'string'
  && CreatorImageProcessingTaskStatusValues.includes(value as CreatorImageProcessingTaskStatus)
);

export const isCreatorImageProcessingOperation = (
  value: unknown,
): value is CreatorImageProcessingOperation => (
  typeof value === 'string'
  && CreatorImageProcessingOperationValues.includes(value as CreatorImageProcessingOperation)
);

export const isCreatorImageProcessingOutputFormat = (
  value: unknown,
): value is CreatorImageProcessingOutputFormat => (
  typeof value === 'string'
  && CreatorImageProcessingOutputFormatValues.includes(value as CreatorImageProcessingOutputFormat)
);

export const isCreatorImageProcessingPlanSchemaVersion = (
  value: unknown,
): value is CreatorImageProcessingPlanSchemaVersion => (
  typeof value === 'string'
  && CreatorImageProcessingPlanSchemaVersionValues.includes(value as CreatorImageProcessingPlanSchemaVersion)
);

export const isCreatorImageProcessingRisk = (value: unknown): value is CreatorImageProcessingRisk => (
  typeof value === 'string'
  && CreatorImageProcessingRiskValues.includes(value as CreatorImageProcessingRisk)
);

export const isCreatorImageProcessingCreatedBy = (
  value: unknown,
): value is CreatorImageProcessingCreatedBy => (
  typeof value === 'string'
  && CreatorImageProcessingCreatedByValues.includes(value as CreatorImageProcessingCreatedBy)
);

export const isCreatorImageProcessingPresetId = (
  value: unknown,
): value is CreatorImageProcessingPresetId => (
  typeof value === 'string'
  && CreatorImageProcessingPresetIdValues.includes(value as CreatorImageProcessingPresetId)
);

export const isCreatorRecipeOutputKind = (
  value: unknown,
): value is CreatorRecipeOutputKind => (
  typeof value === 'string'
  && CreatorRecipeOutputKindValues.includes(value as CreatorRecipeOutputKind)
);

export const isCreatorRecipeImageProcessingPackKind = (
  value: unknown,
): value is CreatorRecipeImageProcessingPackKind => (
  typeof value === 'string'
  && CreatorRecipeImageProcessingPackKindValues.includes(value as CreatorRecipeImageProcessingPackKind)
);

export const isCreatorRecipeOutputSchemaVersion = (
  value: unknown,
): value is CreatorRecipeOutputSchemaVersion => (
  typeof value === 'string'
  && CreatorRecipeOutputSchemaVersionValues.includes(value as CreatorRecipeOutputSchemaVersion)
);

export const isCreatorAssetAdoptionStatus = (value: unknown): value is CreatorAssetAdoptionStatus => (
  typeof value === 'string'
  && CreatorAssetAdoptionStatusValues.includes(value as CreatorAssetAdoptionStatus)
);

export const isCreatorAssetSelectionStatus = (value: unknown): value is CreatorAssetSelectionStatus => (
  typeof value === 'string'
  && CreatorAssetSelectionStatusValues.includes(value as CreatorAssetSelectionStatus)
);

export const isCreatorBoardCardKind = (value: unknown): value is CreatorBoardCardKind => (
  typeof value === 'string'
  && CreatorBoardCardKindValues.includes(value as CreatorBoardCardKind)
);

export const isCreatorBoardMoveDirection = (value: unknown): value is CreatorBoardMoveDirection => (
  typeof value === 'string'
  && CreatorBoardMoveDirectionValues.includes(value as CreatorBoardMoveDirection)
);

export const isCreatorCreativeModelOutputKind = (value: unknown): value is CreatorCreativeModelOutputKind => (
  typeof value === 'string'
  && CreatorCreativeModelOutputKindValues.includes(value as CreatorCreativeModelOutputKind)
);

export const isCreatorBatchRunStatus = (value: unknown): value is CreatorBatchRunStatus => (
  typeof value === 'string'
  && CreatorBatchRunStatusValues.includes(value as CreatorBatchRunStatus)
);

export const isCreatorBatchTaskStatus = (value: unknown): value is CreatorBatchTaskStatus => (
  typeof value === 'string'
  && CreatorBatchTaskStatusValues.includes(value as CreatorBatchTaskStatus)
);
