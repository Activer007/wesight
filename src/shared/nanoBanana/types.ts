import type {
  NanoBananaPromptImportType,
  NanoBananaSourceStatus,
  NanoBananaSourceType,
  NanoBananaSyncStatus,
  NanoBananaUsageEventType,
} from './constants';

export interface NanoBananaSourcePaths {
  meta: string;
  index: string;
  page: string;
}

export interface NanoBananaPromptSource {
  id: string;
  name: string;
  baseUrl: string;
  sourceType: NanoBananaSourceType;
  paths: NanoBananaSourcePaths;
  enabled: boolean;
  lastSyncedAt?: number | null;
  lastCheckedAt?: number | null;
  lastUpdatedRemote?: string | null;
  totalItems?: number;
  totalPages?: number;
  itemsPerPage?: number;
  totalCategories?: number;
  preRenderedPages?: number;
  etagMeta?: string | null;
  etagIndex?: string | null;
  metadata?: Record<string, unknown>;
  raw?: unknown;
  createdAt?: number;
  updatedAt?: number;
}

export interface NanoBananaSourceStatusSnapshot {
  source: NanoBananaPromptSource;
  status: NanoBananaSourceStatus;
  indexItemCount: number;
  cachedPromptCount: number;
  cachedPageCount: number;
  lastError?: string | null;
}

export interface NanoBananaFeedMeta {
  version: string;
  lastUpdated: string;
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  totalCategories?: number;
  preRenderedPages?: number;
}

export interface NanoBananaAuthor {
  name: string;
  link?: string;
}

export interface NanoBananaPromptIndexItem {
  id: string;
  sourceId: string;
  sourcePromptId: string;
  title: string;
  description: string;
  authorName: string;
  categories: string[];
  publishedAt: string | null;
  likes: number;
  resultsCount: number;
  page: number;
  searchTerms: string;
  thumbnailUrl: string | null;
  raw: unknown;
  createdAt?: number;
  updatedAt?: number;
}

export interface NanoBananaPrompt {
  id: string;
  sourceId: string;
  sourcePromptId: string;
  title: string;
  description: string;
  content: string;
  translatedContent?: string | null;
  sourceLink?: string | null;
  sourcePlatform?: string | null;
  sourcePublishedAt?: string | null;
  author?: NanoBananaAuthor | null;
  media: string[];
  mediaThumbnails: string[];
  language: string;
  searchIndex: string;
  likes: number;
  resultsCount: number;
  needReferenceImages: boolean;
  promptCategories: string[];
  tags: string[];
  tagsZh: string[];
  page?: number | null;
  raw: unknown;
  createdAt?: number;
  updatedAt?: number;
}

export interface NanoBananaPromptPage {
  sourceId: string;
  page: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
  itemCount: number;
  etag?: string | null;
  raw: unknown;
  fetchedAt?: number;
  updatedAt?: number;
}

export interface NanoBananaSearchInput {
  sourceId?: string;
  query?: string;
  categories?: string[];
  tags?: string[];
  needReferenceImages?: boolean;
  limit?: number;
  offset?: number;
}

export interface NanoBananaSearchResult {
  items: NanoBananaPromptIndexItem[];
  totalItems: number;
  limit: number;
  offset: number;
}

export interface NanoBananaSyncResult {
  sourceId: string;
  status: NanoBananaSyncStatus;
  checkedAt: number;
  syncedAt?: number | null;
  metaChanged: boolean;
  indexItemCount: number;
  pageCount: number;
  warnings: string[];
  error?: string | null;
}

export interface NanoBananaPromptConvertResult {
  sourceId: string;
  promptId: string;
  sourcePromptId: string;
  promptSpec: unknown;
  warnings: string[];
}

export interface NanoBananaPromptImportRecord {
  id: string;
  sourceId: string;
  promptId: string;
  sourcePromptId: string;
  importType: NanoBananaPromptImportType;
  projectId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface NanoBananaUsageEventRecord {
  id: string;
  sourceId: string;
  promptId?: string | null;
  sourcePromptId?: string | null;
  eventType: NanoBananaUsageEventType;
  importType?: NanoBananaPromptImportType | null;
  projectId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: number;
}
