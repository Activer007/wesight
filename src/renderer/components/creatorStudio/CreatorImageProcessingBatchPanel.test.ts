import { CreatorImageProcessingJobStatus } from '@shared/creatorStudio/constants';
import { expect, test } from 'vitest';

import {
  formatImageProcessingBytes,
  getImageProcessingJobSummary,
} from './CreatorImageProcessingBatchPanel';

test('formats image processing byte values for batch panel', () => {
  expect(formatImageProcessingBytes(0)).toBe('0 B');
  expect(formatImageProcessingBytes(512)).toBe('512 B');
  expect(formatImageProcessingBytes(1536)).toBe('1.5 KB');
});

test('summarizes image processing job progress', () => {
  expect(getImageProcessingJobSummary({
    id: 'job-1',
    projectId: 'project-1',
    planId: 'plan-1',
    status: CreatorImageProcessingJobStatus.PartialFailed,
    totalCount: 3,
    successCount: 2,
    failedCount: 1,
    inputTotalSize: 100,
    outputTotalSize: 60,
    savedSize: 40,
    savedPercentage: 40,
    runtimeMetrics: null,
    reportAssetId: null,
    reportPath: null,
    createdAt: 1,
    startedAt: 1,
    completedAt: 2,
  })).toBe('2/3 · partial_failed');
});
