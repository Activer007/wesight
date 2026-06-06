import type {
  CreatorImageMetadataStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOperation,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingPlanSchemaVersion,
  CreatorImageProcessingPlanStatus,
  CreatorImageProcessingPresetId,
  CreatorImageProcessingRisk,
  CreatorImageProcessingSourceKind,
  CreatorImageProcessingTaskStatus,
} from './constants';

export interface CreatorImageMetadata {
  sourcePath: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  format: string | null;
  mimeType: string | null;
  hasAlpha: boolean | null;
  exifOrientation: number | null;
  colorSpace: string | null;
  inspectedAt: number;
  status: CreatorImageMetadataStatus;
  warningCodes: string[];
  errorCode?: string;
  errorMessage?: string;
}

export interface CreatorImageProcessingSource {
  sourceKind: CreatorImageProcessingSourceKind;
  assetId?: string;
  sessionId?: string;
  messageId?: string;
  artifactId?: string;
  filePath?: string;
}

export interface CreatorImageProcessingInputItem {
  id: string;
  source: CreatorImageProcessingSource;
  sourceAssetId: string | null;
  sourcePath: string;
  metadata: CreatorImageMetadata | null;
}

export interface CreatorImageProcessingOperationStep {
  id: string;
  operation: CreatorImageProcessingOperation;
  params: Record<string, unknown>;
}

export interface CreatorImageProcessingOutput {
  format: CreatorImageProcessingOutputFormat;
  quality: number | null;
  outputDirectory: string | null;
  fileNamePattern: string;
  overwrite: false;
}

export interface CreatorImageProcessingOutputItem {
  inputItemId: string;
  sourceAssetId: string | null;
  outputDirectory: string;
  fileName: string;
  outputPath: string;
  width: number | null;
  height: number | null;
  format: CreatorImageProcessingOutputFormat;
}

export interface CreatorImageProcessingWarning {
  code: string;
  severity: CreatorImageProcessingRisk;
  messageKey: string | null;
  details?: Record<string, unknown>;
}

export interface CreatorImageProcessingPlan {
  schemaVersion: CreatorImageProcessingPlanSchemaVersion;
  id: string;
  projectId: string;
  source: CreatorImageProcessingSource;
  inputItems: CreatorImageProcessingInputItem[];
  presetId: CreatorImageProcessingPresetId | null;
  operations: CreatorImageProcessingOperationStep[];
  output: CreatorImageProcessingOutput;
  outputItems: CreatorImageProcessingOutputItem[];
  warnings: CreatorImageProcessingWarning[];
  estimatedRisk: CreatorImageProcessingRisk;
  createdBy: CreatorImageProcessingCreatedBy;
  status: CreatorImageProcessingPlanStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreatorImageProcessingJob {
  id: string;
  projectId: string;
  planId: string;
  status: CreatorImageProcessingJobStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  inputTotalSize: number;
  outputTotalSize: number;
  savedSize: number;
  savedPercentage: number;
  runtimeMetrics: CreatorImageProcessingRuntimeMetrics | null;
  reportAssetId: string | null;
  reportPath: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface CreatorImageProcessingRuntimeMetrics {
  backend: 'sharp';
  source: CreatorImageProcessingSource['sourceKind'];
  preset: CreatorImageProcessingPresetId | null;
  durationMs: number;
  imageCount: number;
  successCount: number;
  failedCount: number;
  inputSize: number;
  outputSize: number;
  savedSize: number;
  savedPercentage: number;
}

export interface CreatorImageProcessingReport {
  jobId: string;
  planId: string;
  projectId: string;
  title: string;
  markdown: string;
  reportPath: string;
  metrics: CreatorImageProcessingRuntimeMetrics;
  failureReasons: Array<{
    code: string;
    message: string;
    count: number;
  }>;
  createdAt: number;
}

export interface CreatorImagePlanCreateInput {
  assetId: string;
  presetId?: CreatorImageProcessingPresetId | null;
  outputFormat?: CreatorImageProcessingOutputFormat | null;
  quality?: number | null;
  width?: number | null;
  height?: number | null;
  maxWidth?: number | null;
  maxHeight?: number | null;
  cropRatio?: string | null;
  rotate?: number | null;
  outputDirectory?: string | null;
}

export interface CreatorImagePlanCreateResult {
  plan: CreatorImageProcessingPlan;
}

export interface CreatorImagePlanGetInput {
  planId: string;
}

export interface CreatorImagePlanGetResult {
  plan: CreatorImageProcessingPlan;
}

export interface CreatorImageJobExecuteInput {
  planId: string;
}

export interface CreatorImageJobExecuteResult {
  job: CreatorImageProcessingJob;
  tasks: CreatorImageProcessingTask[];
  outputAssetIds: string[];
}

export interface CreatorImageJobGetInput {
  jobId: string;
}

export interface CreatorImageJobGetResult {
  job: CreatorImageProcessingJob;
  tasks: CreatorImageProcessingTask[];
}

export interface CreatorImageJobListInput {
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface CreatorImageJobListResult {
  jobs: Array<{
    job: CreatorImageProcessingJob;
    tasks: CreatorImageProcessingTask[];
  }>;
  total: number;
}

export interface CreatorImageBatchCreateInput {
  projectId: string;
  assetIds: string[];
  waitForCompletion?: boolean;
  presetId?: CreatorImageProcessingPresetId | null;
  outputFormat?: CreatorImageProcessingOutputFormat | null;
  quality?: number | null;
  width?: number | null;
  height?: number | null;
  maxWidth?: number | null;
  maxHeight?: number | null;
  cropRatio?: string | null;
  rotate?: number | null;
  outputDirectory?: string | null;
}

export interface CreatorImageBatchCreateResult {
  plan: CreatorImageProcessingPlan;
  job: CreatorImageProcessingJob;
  tasks: CreatorImageProcessingTask[];
  outputAssetIds: string[];
}

export interface CreatorImageTaskRetryInput {
  taskId: string;
}

export interface CreatorImageTaskRetryResult {
  job: CreatorImageProcessingJob;
  tasks: CreatorImageProcessingTask[];
  outputAssetIds: string[];
}

export interface CreatorImageTaskCancelInput {
  taskId: string;
}

export interface CreatorImageTaskCancelResult {
  job: CreatorImageProcessingJob;
  tasks: CreatorImageProcessingTask[];
}

export interface CreatorImageOutputRevealInput {
  jobId?: string;
  taskId?: string;
  outputPath?: string;
}

export interface CreatorImageReportOpenInput {
  jobId: string;
}

export interface CreatorImageProcessingTask {
  id: string;
  jobId: string;
  projectId: string;
  sourceAssetId: string | null;
  outputAssetId: string | null;
  sourceArtifactId: string | null;
  sourcePath: string;
  outputPath: string | null;
  status: CreatorImageProcessingTaskStatus;
  inputSize: number | null;
  outputSize: number | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}
