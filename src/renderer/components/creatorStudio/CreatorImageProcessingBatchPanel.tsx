import {
  ArrowPathIcon,
  FolderOpenIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { CreatorImageProcessingTaskStatus } from '@shared/creatorStudio/constants';
import type {
  CreatorImageJobListResult,
  CreatorImageOutputRevealInput,
  CreatorImageProcessingJob,
  CreatorImageProcessingTask,
} from '@shared/creatorStudio/imageProcessingTypes';
import React from 'react';

import { i18nService } from '../../services/i18n';

export const formatImageProcessingBytes = (value: number | null | undefined): string => {
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

const taskStatusLabel = (status: CreatorImageProcessingTaskStatus): string => {
  switch (status) {
    case CreatorImageProcessingTaskStatus.Pending:
      return i18nService.t('creatorBatchStatusPending');
    case CreatorImageProcessingTaskStatus.Running:
      return i18nService.t('creatorBatchStatusRunning');
    case CreatorImageProcessingTaskStatus.Completed:
      return i18nService.t('creatorBatchStatusCompleted');
    case CreatorImageProcessingTaskStatus.Failed:
      return i18nService.t('creatorBatchStatusFailed');
    case CreatorImageProcessingTaskStatus.Canceled:
      return i18nService.t('creatorImageBatchStatusCanceled');
    case CreatorImageProcessingTaskStatus.Skipped:
    default:
      return i18nService.t('creatorBatchStatusSkipped');
  }
};

export const getImageProcessingJobSummary = (job: CreatorImageProcessingJob): string => (
  `${job.successCount}/${job.totalCount} · ${job.status}`
);

export const CreatorImageProcessingBatchPanel: React.FC<{
  jobs: CreatorImageJobListResult['jobs'];
  onRefresh: () => void;
  onRevealOutput: (input: CreatorImageOutputRevealInput) => void;
  onRetryTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
}> = ({
  jobs,
  onRefresh,
  onRevealOutput,
  onRetryTask,
  onCancelTask,
}) => (
  <section className="space-y-4 p-4">
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">{i18nService.t('creatorImageBatchPanelTitle')}</h2>
        <p className="mt-1 text-xs text-muted">{i18nService.t('creatorImageBatchPanelHint')}</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
        aria-label={i18nService.t('creatorBatchRefresh')}
      >
        <ArrowPathIcon className="h-4 w-4" />
      </button>
    </div>

    {jobs.length === 0 ? (
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted">
        {i18nService.t('creatorImageBatchEmpty')}
      </div>
    ) : jobs.map(({ job, tasks }) => (
      <article key={job.id} className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{job.id}</h3>
              <p className="mt-1 text-xs text-muted">{getImageProcessingJobSummary(job)}</p>
            </div>
            <button
              type="button"
              onClick={() => onRevealOutput({ jobId: job.id })}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              <FolderOpenIcon className="h-4 w-4" />
              {i18nService.t('creatorImageProcessingOpenOutputDirectory')}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <SummaryCell label={i18nService.t('creatorImageBatchTotal')} value={String(job.totalCount)} />
            <SummaryCell label={i18nService.t('creatorImageBatchSuccessFailed')} value={`${job.successCount}/${job.failedCount}`} />
            <SummaryCell label={i18nService.t('creatorImageProcessingInputSize')} value={formatImageProcessingBytes(job.inputTotalSize)} />
            <SummaryCell label={i18nService.t('creatorImageProcessingSavedSize')} value={formatImageProcessingBytes(job.savedSize)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs">
            <thead className="bg-surface-raised text-muted">
              <tr>
                <Th>{i18nService.t('creatorImageBatchTask')}</Th>
                <Th>{i18nService.t('creatorBatchStatus')}</Th>
                <Th>{i18nService.t('creatorImageProcessingInputSize')}</Th>
                <Th>{i18nService.t('creatorImageProcessingOutputSize')}</Th>
                <Th>{i18nService.t('creatorImageProcessingOutputFile')}</Th>
                <Th>{i18nService.t('creatorBatchActions')}</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onRevealOutput={onRevealOutput}
                  onRetryTask={onRetryTask}
                  onCancelTask={onCancelTask}
                />
              ))}
            </tbody>
          </table>
        </div>
      </article>
    ))}
  </section>
);

const TaskRow: React.FC<{
  task: CreatorImageProcessingTask;
  onRevealOutput: (input: CreatorImageOutputRevealInput) => void;
  onRetryTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
}> = ({ task, onRevealOutput, onRetryTask, onCancelTask }) => (
  <tr className="border-t border-border">
    <Td>
      <div className="max-w-[260px] truncate" title={task.sourcePath}>{task.sourcePath}</div>
      {task.errorMessage && <div className="mt-1 max-w-[260px] truncate text-red-500" title={task.errorMessage}>{task.errorMessage}</div>}
    </Td>
    <Td>{taskStatusLabel(task.status)}</Td>
    <Td>{formatImageProcessingBytes(task.inputSize)}</Td>
    <Td>{formatImageProcessingBytes(task.outputSize)}</Td>
    <Td><div className="max-w-[240px] truncate" title={task.outputPath ?? ''}>{task.outputPath ?? '-'}</div></Td>
    <Td>
      <div className="flex gap-1">
        <IconButton title={i18nService.t('creatorImageProcessingOpenOutputDirectory')} onClick={() => onRevealOutput({ taskId: task.id, outputPath: task.outputPath ?? undefined })}>
          <FolderOpenIcon className="h-4 w-4" />
        </IconButton>
        {task.status === CreatorImageProcessingTaskStatus.Failed && (
          <IconButton title={i18nService.t('creatorBatchRetry')} onClick={() => onRetryTask(task.id)}>
            <ArrowPathIcon className="h-4 w-4" />
          </IconButton>
        )}
        {task.status === CreatorImageProcessingTaskStatus.Pending && (
          <IconButton title={i18nService.t('creatorImageBatchCancelTask')} onClick={() => onCancelTask(task.id)}>
            <XMarkIcon className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </Td>
  </tr>
);

const SummaryCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <div className="text-[11px] text-muted">{label}</div>
    <div className="mt-1 truncate font-semibold">{value}</div>
  </div>
);

const IconButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
  >
    {children}
  </button>
);

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="px-3 py-2 font-medium">{children}</th>
);

const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="px-3 py-2 align-top">{children}</td>
);
