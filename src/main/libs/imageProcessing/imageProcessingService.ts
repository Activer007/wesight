import { mkdir, stat } from 'fs/promises';
import path from 'path';
import type { Sharp } from 'sharp';

import {
  CreatorImageMetadataStatus,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOperation,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingTaskStatus,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageMetadata,
  CreatorImageProcessingJob,
  CreatorImageProcessingPlan,
  CreatorImageProcessingTask,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import type { CreatorProductionAssetRecord } from '../../../shared/creatorStudio/types';
import { inspectImageMetadata } from './imageMetadataInspector';
import { ImageProcessingError, ImageProcessingErrorCode } from './imageProcessingErrors';
import {
  createImageProcessingPlan,
  type CreateImageProcessingPlanInput,
} from './imageProcessingPlanner';

export interface ImageProcessingExecutionResult {
  job: CreatorImageProcessingJob;
  tasks: CreatorImageProcessingTask[];
  outputAssets: CreatorProductionAssetRecord[];
}

export interface ImageProcessingExecuteOptions {
  createAsset?: (input: {
    outputPath: string;
    fileName: string;
    mimeType: string | null;
    imageMetadata: CreatorImageMetadata;
    plan: CreatorImageProcessingPlan;
    job: CreatorImageProcessingJob;
    task: CreatorImageProcessingTask;
  }) => CreatorProductionAssetRecord;
}

export interface ImageProcessingTaskExecutionOptions extends ImageProcessingExecuteOptions {
  plan: CreatorImageProcessingPlan;
  task: CreatorImageProcessingTask;
  inputIndex: number;
}

export interface ImageProcessingTaskExecutionResult {
  task: CreatorImageProcessingTask;
  outputAsset: CreatorProductionAssetRecord | null;
}

export interface ImageProcessingService {
  inspect(sourcePath: string): Promise<CreatorImageMetadata>;
  createPlan(input: CreateImageProcessingPlanInput): CreatorImageProcessingPlan;
  savePlan(plan: CreatorImageProcessingPlan): CreatorImageProcessingPlan;
  getPlan(planId: string): CreatorImageProcessingPlan | null;
  getJob(jobId: string): { job: CreatorImageProcessingJob; tasks: CreatorImageProcessingTask[] } | null;
  createJobShell(plan: CreatorImageProcessingPlan): CreatorImageProcessingJob;
  createTaskShell(
    job: CreatorImageProcessingJob,
    plan: CreatorImageProcessingPlan,
    inputIndex: number,
  ): CreatorImageProcessingTask;
  executePlan(
    plan: CreatorImageProcessingPlan,
    options?: ImageProcessingExecuteOptions,
  ): Promise<ImageProcessingExecutionResult>;
  revealTargetFor(input: { jobId?: string; taskId?: string; outputPath?: string }): string | null;
}

export const executeImageProcessingTask = async (
  options: ImageProcessingTaskExecutionOptions,
): Promise<ImageProcessingTaskExecutionResult> => {
  const { plan, task, inputIndex } = options;
  const inputItem = plan.inputItems[inputIndex];
  const outputItem = plan.outputItems[inputIndex];
  if (!inputItem || !outputItem) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.MissingInputItem,
      'input item is required',
    );
  }

  const taskStartedAt = Date.now();

  try {
    if (inputItem.metadata?.status !== CreatorImageMetadataStatus.Ready) {
      throw new ImageProcessingError(
        ImageProcessingErrorCode.UnsupportedFormat,
        'source image is not ready for processing',
      );
    }

    await ensureOutputIsNew(inputItem.sourcePath, outputItem.outputPath);
    await mkdir(outputItem.outputDirectory, { recursive: true });
    task.status = CreatorImageProcessingTaskStatus.Running;
    task.updatedAt = Date.now();

    const pipeline = await applyOperations(inputItem.sourcePath, plan);
    await pipeline.toFile(outputItem.outputPath);
    const outputMetadata = await inspectImageMetadata(outputItem.outputPath);
    const outputSize = outputMetadata.fileSize;

    task.status = CreatorImageProcessingTaskStatus.Completed;
    task.outputSize = outputSize;
    task.durationMs = Date.now() - taskStartedAt;
    task.completedAt = Date.now();
    task.updatedAt = task.completedAt;

    const outputAsset = options.createAsset
      ? options.createAsset({
        outputPath: outputItem.outputPath,
        fileName: outputItem.fileName,
        mimeType: outputMetadata.mimeType ?? toFormatMimeType(plan.output.format),
        imageMetadata: outputMetadata,
        plan,
        job: {
          id: task.jobId,
          projectId: task.projectId,
          planId: plan.id,
          status: CreatorImageProcessingJobStatus.Running,
          totalCount: plan.inputItems.length,
          successCount: 0,
          failedCount: 0,
          inputTotalSize: 0,
          outputTotalSize: 0,
          savedSize: 0,
          savedPercentage: 0,
          runtimeMetrics: null,
          reportAssetId: null,
          reportPath: null,
          createdAt: task.createdAt,
          startedAt: taskStartedAt,
          completedAt: null,
        },
        task,
      })
      : null;
    if (outputAsset) {
      task.outputAssetId = outputAsset.id;
      task.updatedAt = Date.now();
    }

    return { task, outputAsset };
  } catch (error) {
    task.status = CreatorImageProcessingTaskStatus.Failed;
    task.errorCode = error instanceof ImageProcessingError ? error.code : ImageProcessingErrorCode.CorruptImage;
    task.errorMessage = error instanceof Error ? error.message : String(error);
    task.durationMs = Date.now() - taskStartedAt;
    task.completedAt = Date.now();
    task.updatedAt = task.completedAt;
    return { task, outputAsset: null };
  }
};

const toFormatMimeType = (format: CreatorImageProcessingOutputFormat): string => {
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

const getNumericParam = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const parseRatio = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : null;
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

const applyOperations = async (
  sourcePath: string,
  plan: CreatorImageProcessingPlan,
): Promise<Sharp> => {
  const sharp = (await import('sharp')).default;
  let pipeline = sharp(sourcePath, { failOn: 'none' });

  for (const step of plan.operations) {
    switch (step.operation) {
      case CreatorImageProcessingOperation.AutoOrient:
        pipeline = pipeline.rotate();
        break;
      case CreatorImageProcessingOperation.Resize: {
        const width = getNumericParam(step.params.width);
        const height = getNumericParam(step.params.height);
        const maxWidth = getNumericParam(step.params.maxWidth);
        const maxHeight = getNumericParam(step.params.maxHeight);
        const fit = typeof step.params.fit === 'string' ? step.params.fit : 'inside';
        pipeline = pipeline.resize({
          ...(width ? { width: Math.round(width) } : {}),
          ...(height ? { height: Math.round(height) } : {}),
          ...(!width && maxWidth ? { width: Math.round(maxWidth) } : {}),
          ...(!height && maxHeight ? { height: Math.round(maxHeight) } : {}),
          fit: fit === 'cover' ? 'cover' : 'inside',
          withoutEnlargement: step.params.withoutEnlargement === true,
          position: 'centre',
        });
        break;
      }
      case CreatorImageProcessingOperation.Crop: {
        const ratio = parseRatio(step.params.ratio);
        if (ratio) {
          pipeline = await applyCropRatio(pipeline, ratio);
        }
        break;
      }
      case CreatorImageProcessingOperation.Rotate: {
        const angle = getNumericParam(step.params.angle);
        if (angle) {
          pipeline = pipeline.rotate(angle);
        }
        break;
      }
      case CreatorImageProcessingOperation.Convert:
      case CreatorImageProcessingOperation.Compress:
        break;
      default:
        break;
    }
  }

  const quality = plan.output.quality ?? 80;
  switch (plan.output.format) {
    case CreatorImageProcessingOutputFormat.Avif:
      return pipeline.avif({ quality });
    case CreatorImageProcessingOutputFormat.Jpeg:
      return pipeline.jpeg({ quality });
    case CreatorImageProcessingOutputFormat.Png:
      return pipeline.png({ quality });
    case CreatorImageProcessingOutputFormat.Webp:
    default:
      return pipeline.webp({ quality });
  }
};

const ensureOutputIsNew = async (sourcePath: string, outputPath: string): Promise<void> => {
  if (path.resolve(sourcePath) === path.resolve(outputPath)) {
    throw new ImageProcessingError(
      ImageProcessingErrorCode.OutputWouldOverwrite,
      'output path must not match the source path',
    );
  }

  try {
    await stat(outputPath);
    throw new ImageProcessingError(
      ImageProcessingErrorCode.OutputExists,
      'output file already exists',
    );
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') throw error;
  }
};

export const createImageProcessingService = (): ImageProcessingService => {
  const plans = new Map<string, CreatorImageProcessingPlan>();
  const jobs = new Map<string, { job: CreatorImageProcessingJob; tasks: CreatorImageProcessingTask[] }>();

  const service: ImageProcessingService = {
    inspect: inspectImageMetadata,

    createPlan: createImageProcessingPlan,

    savePlan: (plan) => {
      plans.set(plan.id, plan);
      return plan;
    },

    getPlan: (planId) => plans.get(planId) ?? null,

    getJob: (jobId) => jobs.get(jobId) ?? null,

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
      savedPercentage: 0,
      runtimeMetrics: null,
      reportAssetId: null,
      reportPath: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    }),

    createTaskShell: (job, plan, inputIndex) => {
      const inputItem = plan.inputItems[inputIndex];
      const outputItem = plan.outputItems[inputIndex];
      if (!inputItem || !outputItem) {
        throw new ImageProcessingError(
          ImageProcessingErrorCode.MissingInputItem,
          'input item is required',
        );
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
    },

    executePlan: async (plan, options = {}) => {
      const job = service.createJobShell(plan);
      const tasks = plan.inputItems.map((_item, index) => service.createTaskShell(job, plan, index));
      const outputAssets: CreatorProductionAssetRecord[] = [];
      const startedAt = Date.now();
      job.status = CreatorImageProcessingJobStatus.Running;
      job.startedAt = startedAt;
      jobs.set(job.id, { job, tasks });

      for (let index = 0; index < plan.inputItems.length; index += 1) {
        const task = tasks[index];
        const taskStartedAt = Date.now();

        try {
          task.status = CreatorImageProcessingTaskStatus.Running;
          task.updatedAt = Date.now();
          const result = await executeImageProcessingTask({
            plan,
            task,
            inputIndex: index,
            createAsset: options.createAsset
              ? (assetInput) => options.createAsset!({ ...assetInput, job })
              : undefined,
          });
          if (result.outputAsset) {
            const outputAsset = result.outputAsset;
            outputAssets.push(outputAsset);
          }
          if (result.task.status === CreatorImageProcessingTaskStatus.Completed) {
            job.successCount += 1;
            job.outputTotalSize += result.task.outputSize ?? 0;
          } else {
            job.failedCount += 1;
          }
        } catch (error) {
          task.status = CreatorImageProcessingTaskStatus.Failed;
          task.errorCode = error instanceof ImageProcessingError ? error.code : ImageProcessingErrorCode.CorruptImage;
          task.errorMessage = error instanceof Error ? error.message : String(error);
          task.durationMs = Date.now() - taskStartedAt;
          task.completedAt = Date.now();
          task.updatedAt = task.completedAt;
          job.failedCount += 1;
        }
      }

      job.completedAt = Date.now();
      job.savedSize = job.inputTotalSize - job.outputTotalSize;
      job.savedPercentage = job.inputTotalSize > 0
        ? Math.round((job.savedSize / job.inputTotalSize) * 10000) / 100
        : 0;
      job.status = job.failedCount > 0
        ? job.successCount > 0
          ? CreatorImageProcessingJobStatus.PartialFailed
          : CreatorImageProcessingJobStatus.Failed
        : CreatorImageProcessingJobStatus.Completed;
      jobs.set(job.id, { job, tasks });
      return { job, tasks, outputAssets };
    },

    revealTargetFor: (input) => {
      if (input.outputPath?.trim()) return input.outputPath.trim();
      if (input.taskId?.trim()) {
        for (const record of jobs.values()) {
          const task = record.tasks.find((item) => item.id === input.taskId);
          if (task?.outputPath) return task.outputPath;
        }
      }
      if (input.jobId?.trim()) {
        const record = jobs.get(input.jobId.trim());
        return record?.tasks.find((task) => task.outputPath)?.outputPath ?? null;
      }
      return null;
    },
  };

  return service;
};
