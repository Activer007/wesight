import { expect, test } from 'vitest';

import {
  isNanoBananaIpcChannel,
  isNanoBananaPromptImportType,
  isNanoBananaSearchSort,
  isNanoBananaSourceStatus,
  isNanoBananaSourceType,
  isNanoBananaSyncStatus,
  isNanoBananaUsageEventType,
  NanoBananaIpcChannel,
  NanoBananaIpcChannelValues,
  NanoBananaPromptImportType,
  NanoBananaPromptImportTypeValues,
  NanoBananaSearchSort,
  NanoBananaSearchSortValues,
  NanoBananaSourceStatus,
  NanoBananaSourceStatusValues,
  NanoBananaSourceType,
  NanoBananaSourceTypeValues,
  NanoBananaSyncStatus,
  NanoBananaSyncStatusValues,
  NanoBananaUsageEventType,
  NanoBananaUsageEventTypeValues,
} from './constants';

test('exposes values and type guards for Nano Banana constants', () => {
  expect(NanoBananaSourceTypeValues).toContain(NanoBananaSourceType.StaticJson);
  expect(NanoBananaSourceStatusValues).toContain(NanoBananaSourceStatus.Ready);
  expect(NanoBananaIpcChannelValues).toContain(NanoBananaIpcChannel.Search);
  expect(NanoBananaPromptImportTypeValues).toContain(NanoBananaPromptImportType.Recipe);
  expect(NanoBananaUsageEventTypeValues).toContain(NanoBananaUsageEventType.Copy);
  expect(NanoBananaSyncStatusValues).toContain(NanoBananaSyncStatus.Completed);
  expect(NanoBananaSearchSortValues).toContain(NanoBananaSearchSort.Relevance);

  expect(isNanoBananaSourceType(NanoBananaSourceType.StaticJson)).toBe(true);
  expect(isNanoBananaSourceStatus(NanoBananaSourceStatus.Ready)).toBe(true);
  expect(isNanoBananaIpcChannel(NanoBananaIpcChannel.PromptGet)).toBe(true);
  expect(isNanoBananaPromptImportType(NanoBananaPromptImportType.BoardCard)).toBe(true);
  expect(isNanoBananaUsageEventType(NanoBananaUsageEventType.UseInBuilder)).toBe(true);
  expect(isNanoBananaSyncStatus(NanoBananaSyncStatus.Failed)).toBe(true);
  expect(isNanoBananaSearchSort(NanoBananaSearchSort.PublishedDesc)).toBe(true);

  expect(isNanoBananaSourceType('static-json')).toBe(false);
  expect(isNanoBananaUsageEventType('open')).toBe(false);
  expect(isNanoBananaSearchSort('newest')).toBe(false);
});
