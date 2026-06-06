import path from 'path';

import type {
  CreatorImageProcessingJob,
  CreatorImageProcessingPlan,
  CreatorImageProcessingReport,
  CreatorImageProcessingRuntimeMetrics,
  CreatorImageProcessingTask,
} from '../../../shared/creatorStudio/imageProcessingTypes';

export interface CreateImageProcessingReportInput {
  plan: CreatorImageProcessingPlan;
  job: CreatorImageProcessingJob;
  tasks: CreatorImageProcessingTask[];
  reportPath: string;
  now?: number;
}

export const calculateImageProcessingSavedPercentage = (
  inputSize: number,
  savedSize: number,
): number => {
  if (inputSize <= 0) return 0;
  return Math.round((savedSize / inputSize) * 10000) / 100;
};

export const summarizeImageProcessingFailureReasons = (
  tasks: CreatorImageProcessingTask[],
): CreatorImageProcessingReport['failureReasons'] => {
  const reasons = new Map<string, { code: string; message: string; count: number }>();
  for (const task of tasks) {
    if (!task.errorCode && !task.errorMessage) continue;
    const code = task.errorCode || 'unknown_error';
    const message = sanitizeReportText(task.errorMessage || code);
    const key = `${code}:${message}`;
    const existing = reasons.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      reasons.set(key, { code, message, count: 1 });
    }
  }
  return [...reasons.values()].sort((left, right) => right.count - left.count);
};

export const createImageProcessingRuntimeMetrics = (
  plan: CreatorImageProcessingPlan,
  job: CreatorImageProcessingJob,
): CreatorImageProcessingRuntimeMetrics => {
  const durationMs = job.startedAt && job.completedAt
    ? Math.max(0, job.completedAt - job.startedAt)
    : 0;
  const savedPercentage = calculateImageProcessingSavedPercentage(job.inputTotalSize, job.savedSize);
  return {
    backend: 'sharp',
    source: plan.source.sourceKind,
    preset: plan.presetId,
    durationMs,
    imageCount: job.totalCount,
    successCount: job.successCount,
    failedCount: job.failedCount,
    inputSize: job.inputTotalSize,
    outputSize: job.outputTotalSize,
    savedSize: job.savedSize,
    savedPercentage,
  };
};

export const createImageProcessingReport = (
  input: CreateImageProcessingReportInput,
): CreatorImageProcessingReport => {
  const now = input.now ?? Date.now();
  const metrics = createImageProcessingRuntimeMetrics(input.plan, input.job);
  const failureReasons = summarizeImageProcessingFailureReasons(input.tasks);
  const outputDirectories = [...new Set(input.plan.outputItems.map((item) => item.outputDirectory))]
    .filter(Boolean)
    .sort();
  const outputDirectory = outputDirectories.length === 1
    ? outputDirectories[0]
    : `${outputDirectories.length} output directories`;
  const title = `Image processing job ${input.job.id}`;
  const markdown = renderImageProcessingReportMarkdown({
    title,
    plan: input.plan,
    job: input.job,
    metrics,
    failureReasons,
    outputDirectory,
  });
  return {
    jobId: input.job.id,
    planId: input.plan.id,
    projectId: input.job.projectId,
    title,
    markdown,
    reportPath: input.reportPath,
    metrics,
    failureReasons,
    createdAt: now,
  };
};

const renderImageProcessingReportMarkdown = (input: {
  title: string;
  plan: CreatorImageProcessingPlan;
  job: CreatorImageProcessingJob;
  metrics: CreatorImageProcessingRuntimeMetrics;
  failureReasons: CreatorImageProcessingReport['failureReasons'];
  outputDirectory: string;
}): string => {
  const lines = [
    `# ${input.title}`,
    '',
    '## Summary',
    '',
    `- Job: ${input.job.id}`,
    `- Plan: ${input.plan.id}`,
    `- Status: ${input.job.status}`,
    `- Input images: ${input.job.totalCount}`,
    `- Success / failed: ${input.job.successCount} / ${input.job.failedCount}`,
    `- Original size: ${formatBytes(input.job.inputTotalSize)}`,
    `- Output size: ${formatBytes(input.job.outputTotalSize)}`,
    `- Saved size: ${formatBytes(input.job.savedSize)} (${input.metrics.savedPercentage.toFixed(2)}%)`,
    `- Duration: ${formatDuration(input.metrics.durationMs)}`,
    `- Output format: ${input.plan.output.format}`,
    `- Preset: ${input.plan.presetId ?? 'custom'}`,
    `- Backend: ${input.metrics.backend}`,
    `- Output directory: ${sanitizeReportText(input.outputDirectory)}`,
    '',
    '## Failures',
    '',
  ];

  if (input.failureReasons.length === 0) {
    lines.push('- None');
  } else {
    for (const reason of input.failureReasons) {
      lines.push(`- ${reason.code}: ${reason.message} (${reason.count})`);
    }
  }

  lines.push('', '## Outputs', '');
  for (const output of input.plan.outputItems) {
    lines.push(`- ${sanitizeReportText(path.basename(output.outputPath))}`);
  }

  return `${lines.join('\n')}\n`;
};

const sanitizeReportText = (value: string): string => (
  value
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '[redacted-base64]')
    .replace(/\s+/g, ' ')
    .trim()
);

const formatBytes = (value: number): string => {
  if (!value || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDuration = (durationMs: number): string => {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
};
