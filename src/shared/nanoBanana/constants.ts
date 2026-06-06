export const NanoBananaSourceType = {
  StaticJson: 'static_json',
  PublicApi: 'public_api',
  LocalFile: 'local_file',
} as const;

export type NanoBananaSourceType =
  typeof NanoBananaSourceType[keyof typeof NanoBananaSourceType];

export const NanoBananaSourceTypeValues = [
  NanoBananaSourceType.StaticJson,
  NanoBananaSourceType.PublicApi,
  NanoBananaSourceType.LocalFile,
] as const;

export const NanoBananaSourceStatus = {
  Ready: 'ready',
  Stale: 'stale',
  Empty: 'empty',
  Error: 'error',
} as const;

export type NanoBananaSourceStatus =
  typeof NanoBananaSourceStatus[keyof typeof NanoBananaSourceStatus];

export const NanoBananaSourceStatusValues = [
  NanoBananaSourceStatus.Ready,
  NanoBananaSourceStatus.Stale,
  NanoBananaSourceStatus.Empty,
  NanoBananaSourceStatus.Error,
] as const;

export const NanoBananaIpcChannel = {
  SourceList: 'nanoBanana:source:list',
  SourceStatus: 'nanoBanana:source:status',
  Sync: 'nanoBanana:sync',
  Search: 'nanoBanana:search',
  PromptGet: 'nanoBanana:prompt:get',
  PromptConvert: 'nanoBanana:prompt:convert',
  ImportRecord: 'nanoBanana:import:record',
  UsageRecord: 'nanoBanana:usage:record',
} as const;

export type NanoBananaIpcChannel =
  typeof NanoBananaIpcChannel[keyof typeof NanoBananaIpcChannel];

export const NanoBananaIpcChannelValues = [
  NanoBananaIpcChannel.SourceList,
  NanoBananaIpcChannel.SourceStatus,
  NanoBananaIpcChannel.Sync,
  NanoBananaIpcChannel.Search,
  NanoBananaIpcChannel.PromptGet,
  NanoBananaIpcChannel.PromptConvert,
  NanoBananaIpcChannel.ImportRecord,
  NanoBananaIpcChannel.UsageRecord,
] as const;

export const NanoBananaPromptImportType = {
  Builder: 'builder',
  Recipe: 'recipe',
  PromptAsset: 'prompt_asset',
  BoardCard: 'board_card',
  Cowork: 'cowork',
  Batch: 'batch',
} as const;

export type NanoBananaPromptImportType =
  typeof NanoBananaPromptImportType[keyof typeof NanoBananaPromptImportType];

export const NanoBananaPromptImportTypeValues = [
  NanoBananaPromptImportType.Builder,
  NanoBananaPromptImportType.Recipe,
  NanoBananaPromptImportType.PromptAsset,
  NanoBananaPromptImportType.BoardCard,
  NanoBananaPromptImportType.Cowork,
  NanoBananaPromptImportType.Batch,
] as const;

export const NanoBananaUsageEventType = {
  View: 'view',
  Copy: 'copy',
  UseInBuilder: 'use_in_builder',
  SaveAsRecipe: 'save_as_recipe',
  SaveAsPromptAsset: 'save_as_prompt_asset',
  AddToBoard: 'add_to_board',
  SendToCowork: 'send_to_cowork',
  CreateBatch: 'create_batch',
  AdoptAsset: 'adopt_asset',
  RejectAsset: 'reject_asset',
} as const;

export type NanoBananaUsageEventType =
  typeof NanoBananaUsageEventType[keyof typeof NanoBananaUsageEventType];

export const NanoBananaUsageEventTypeValues = [
  NanoBananaUsageEventType.View,
  NanoBananaUsageEventType.Copy,
  NanoBananaUsageEventType.UseInBuilder,
  NanoBananaUsageEventType.SaveAsRecipe,
  NanoBananaUsageEventType.SaveAsPromptAsset,
  NanoBananaUsageEventType.AddToBoard,
  NanoBananaUsageEventType.SendToCowork,
  NanoBananaUsageEventType.CreateBatch,
  NanoBananaUsageEventType.AdoptAsset,
  NanoBananaUsageEventType.RejectAsset,
] as const;

export const NanoBananaSyncStatus = {
  Skipped: 'skipped',
  Completed: 'completed',
  PartialFailed: 'partial_failed',
  Failed: 'failed',
} as const;

export type NanoBananaSyncStatus =
  typeof NanoBananaSyncStatus[keyof typeof NanoBananaSyncStatus];

export const NanoBananaSyncStatusValues = [
  NanoBananaSyncStatus.Skipped,
  NanoBananaSyncStatus.Completed,
  NanoBananaSyncStatus.PartialFailed,
  NanoBananaSyncStatus.Failed,
] as const;

export const NanoBananaSearchSort = {
  Relevance: 'relevance',
  PublishedDesc: 'published_desc',
  LikesDesc: 'likes_desc',
  ResultsDesc: 'results_desc',
} as const;

export type NanoBananaSearchSort =
  typeof NanoBananaSearchSort[keyof typeof NanoBananaSearchSort];

export const NanoBananaSearchSortValues = [
  NanoBananaSearchSort.Relevance,
  NanoBananaSearchSort.PublishedDesc,
  NanoBananaSearchSort.LikesDesc,
  NanoBananaSearchSort.ResultsDesc,
] as const;

export const NanoBananaDefaultSourceId = 'nano-supai';

export const DefaultNanoBananaPromptSource = {
  id: NanoBananaDefaultSourceId,
  name: 'Nano Banana Prompts',
  baseUrl: 'https://nano.supai.site',
  sourceType: NanoBananaSourceType.StaticJson,
  paths: {
    meta: '/data/meta.json',
    index: '/data/index.json',
    page: '/data/pages/page-{page}.json',
  },
  enabled: true,
} as const;

export const isNanoBananaSourceType = (value: unknown): value is NanoBananaSourceType => (
  typeof value === 'string'
  && NanoBananaSourceTypeValues.includes(value as NanoBananaSourceType)
);

export const isNanoBananaSourceStatus = (value: unknown): value is NanoBananaSourceStatus => (
  typeof value === 'string'
  && NanoBananaSourceStatusValues.includes(value as NanoBananaSourceStatus)
);

export const isNanoBananaIpcChannel = (value: unknown): value is NanoBananaIpcChannel => (
  typeof value === 'string'
  && NanoBananaIpcChannelValues.includes(value as NanoBananaIpcChannel)
);

export const isNanoBananaPromptImportType = (
  value: unknown,
): value is NanoBananaPromptImportType => (
  typeof value === 'string'
  && NanoBananaPromptImportTypeValues.includes(value as NanoBananaPromptImportType)
);

export const isNanoBananaUsageEventType = (
  value: unknown,
): value is NanoBananaUsageEventType => (
  typeof value === 'string'
  && NanoBananaUsageEventTypeValues.includes(value as NanoBananaUsageEventType)
);

export const isNanoBananaSyncStatus = (value: unknown): value is NanoBananaSyncStatus => (
  typeof value === 'string'
  && NanoBananaSyncStatusValues.includes(value as NanoBananaSyncStatus)
);

export const isNanoBananaSearchSort = (value: unknown): value is NanoBananaSearchSort => (
  typeof value === 'string'
  && NanoBananaSearchSortValues.includes(value as NanoBananaSearchSort)
);
