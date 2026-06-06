import {
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingTaskStatus,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageMetadata,
  CreatorImageProcessingJob,
  CreatorImageProcessingPlan,
  CreatorImageProcessingTask,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import { inspectImageMetadata } from './imageMetadataInspector';
import { ImageProcessingError, ImageProcessingErrorCode } from './imageProcessingErrors';
import {
  createImageProcessingPlan,
  type CreateImageProcessingPlanInput,
} from './imageProcessingPlanner';

export interface ImageProcessingService {
  inspect(sourcePath: string): Promise<CreatorImageMetadata>;
  createPlan(input: CreateImageProcessingPlanInput): CreatorImageProcessingPlan;
  createJobShell(plan: CreatorImageProcessingPlan): CreatorImageProcessingJob;
  createTaskShell(
    job: CreatorImageProcessingJob,
    plan: CreatorImageProcessingPlan,
    inputIndex: number,
  ): CreatorImageProcessingTask;
  executePlan(plan: CreatorImageProcessingPlan): Promise<CreatorImageProcessingJob>;
}

export const createImageProcessingService = (): ImageProcessingService => ({
  inspect: inspectImageMetadata,

  createPlan: createImageProcessingPlan,

  createJobShell: (plan) => ({
    id: `job-${plan.id}`,
    projectId: plan.projectId,
    planId: plan.id,
    status: CreatorImageProcessingJobStatus.Pending,
    totalCount: plan.inputItems.length,
    successCount: 0,
    failedCount: 0,
    inputTotalSize: plan.inputItems.reduce(
      (total, item) => total + (item.metadata?.fileSize ?? 0),
      0,
    ),
    outputTotalSize: 0,
    savedSize: 0,
    reportAssetId: null,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
  }),

  createTaskShell: (job, plan, inputIndex) => {
    const inputItem = plan.inputItems[inputIndex];
    if (!inputItem) {
      throw new ImageProcessingError(
        ImageProcessingErrorCode.MissingInputItem,
        'input item is required',
      );
    }

    return {
      id: `task-${job.id}-${inputItem.id}`,
      jobId: job.id,
      projectId: plan.projectId,
      sourceAssetId: inputItem.sourceAssetId,
      outputAssetId: null,
      sourceArtifactId: inputItem.source.artifactId ?? null,
      sourcePath: inputItem.sourcePath,
      outputPath: null,
      status: CreatorImageProcessingTaskStatus.Pending,
      inputSize: inputItem.metadata?.fileSize ?? null,
      outputSize: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
    };
  },

  executePlan: async () => {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.ExecutionNotImplemented,
      'image processing execution is not implemented in Phase 0',
    );
  },
});
