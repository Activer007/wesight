import type {
  CreatorImageMetadataStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOperation,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingPlanSchemaVersion,
  CreatorImageProcessingPlanStatus,
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
  presetId: string | null;
  operations: CreatorImageProcessingOperationStep[];
  output: CreatorImageProcessingOutput;
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
  reportAssetId: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
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
