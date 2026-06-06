import {
  NanoBananaDefaultSourceId,
  NanoBananaSearchSort,
} from '../../shared/nanoBanana/constants';
import type { NanoBananaPromptIndexItem, NanoBananaSearchInput, NanoBananaSearchResult } from '../../shared/nanoBanana/types';
import { NanoPromptStore } from './nanoPromptStore';

const MaxSearchLimit = 100;
const DefaultSearchLimit = 30;

interface IndexRow {
  id: string;
  source_id: string;
  source_prompt_id: string;
  title: string;
  description: string;
  author_name: string;
  categories_json: string;
  published_at: string | null;
  likes: number;
  results_count: number;
  page: number;
  search_terms: string;
  thumbnail_url: string | null;
  raw_json: string;
  created_at: number;
  updated_at: number;
  rank_score?: number;
  prompt_need_reference_images?: number | null;
  prompt_tags_json?: string | null;
  prompt_tags_zh_json?: string | null;
  prompt_categories_json?: string | null;
}

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toIndexItem = (row: IndexRow): NanoBananaPromptIndexItem => ({
  id: row.id,
  sourceId: row.source_id,
  sourcePromptId: row.source_prompt_id,
  title: row.title,
  description: row.description,
  authorName: row.author_name,
  categories: parseJson(row.categories_json, []),
  publishedAt: row.published_at,
  likes: row.likes,
  resultsCount: row.results_count,
  page: row.page,
  searchTerms: row.search_terms,
  thumbnailUrl: row.thumbnail_url,
  raw: parseJson(row.raw_json, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeText = (value: string): string => value.trim().toLowerCase();

export const normalizeNanoSearchInput = (input: NanoBananaSearchInput = {}): Required<NanoBananaSearchInput> => ({
  sourceId: input.sourceId?.trim() || NanoBananaDefaultSourceId,
  query: input.query?.trim() || '',
  categories: (input.categories ?? []).map(normalizeText).filter(Boolean),
  tags: (input.tags ?? []).map(normalizeText).filter(Boolean),
  needReferenceImages: input.needReferenceImages ?? false,
  sort: input.sort ?? (input.query?.trim() ? NanoBananaSearchSort.Relevance : NanoBananaSearchSort.PublishedDesc),
  limit: Math.max(1, Math.min(Math.floor(input.limit ?? DefaultSearchLimit), MaxSearchLimit)),
  offset: Math.max(0, Math.floor(input.offset ?? 0)),
});

export class NanoPromptSearch {
  constructor(private readonly store: NanoPromptStore) {}

  search(input: NanoBananaSearchInput = {}): NanoBananaSearchResult {
    const normalized = normalizeNanoSearchInput(input);
    const db = this.store.getDatabase();
    const rows = db
      .prepare(`
        SELECT
          i.*,
          p.need_reference_images AS prompt_need_reference_images,
          p.tags_json AS prompt_tags_json,
          p.tags_zh_json AS prompt_tags_zh_json,
          p.prompt_categories_json AS prompt_categories_json
        FROM nano_prompt_index_items i
        LEFT JOIN nano_prompts p ON p.id = i.id
        WHERE i.source_id = ?
      `)
      .all(normalized.sourceId) as IndexRow[];

    const query = normalizeText(normalized.query);
    const filtered = rows
      .map((row) => ({
        row,
        score: this.getScore(row, query),
      }))
      .filter(({ row, score }) => {
        if (query && score <= 0) return false;
        const categories = [
          ...parseJson<string[]>(row.categories_json, []),
          ...parseJson<string[]>(row.prompt_categories_json, []),
        ].map(normalizeText);
        if (normalized.categories.length > 0 && !normalized.categories.some((category) => categories.includes(category))) {
          return false;
        }
        const searchable = [
          row.search_terms,
          row.raw_json,
          row.prompt_tags_json ?? '',
          row.prompt_tags_zh_json ?? '',
        ].join(' ').toLowerCase();
        if (normalized.tags.length > 0 && !normalized.tags.some((tag) => searchable.includes(tag))) {
          return false;
        }
        if (normalized.needReferenceImages && row.prompt_need_reference_images !== 1 && !searchable.includes('needreferenceimages":true')) {
          return false;
        }
        return true;
      });

    filtered.sort((left, right) => this.compareRows(left.row, right.row, left.score, right.score, normalized.sort));

    return {
      items: filtered
        .slice(normalized.offset, normalized.offset + normalized.limit)
        .map(({ row }) => toIndexItem(row)),
      totalItems: filtered.length,
      limit: normalized.limit,
      offset: normalized.offset,
    };
  }

  private getScore(row: IndexRow, query: string): number {
    if (!query) return 0;
    const title = row.title.toLowerCase();
    const description = row.description.toLowerCase();
    const searchTerms = row.search_terms.toLowerCase();
    const raw = row.raw_json.toLowerCase();
    let score = 0;
    if (title.includes(query)) score += 40;
    if (description.includes(query)) score += 20;
    if (searchTerms.includes(query)) score += 10;
    if (raw.includes(query)) score += 5;
    return score;
  }

  private compareRows(
    left: IndexRow,
    right: IndexRow,
    leftScore: number,
    rightScore: number,
    sort: NanoBananaSearchSort,
  ): number {
    if (sort === NanoBananaSearchSort.Relevance && leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if (sort === NanoBananaSearchSort.LikesDesc) {
      return right.likes - left.likes || right.results_count - left.results_count;
    }
    if (sort === NanoBananaSearchSort.ResultsDesc) {
      return right.results_count - left.results_count || right.likes - left.likes;
    }
    return String(right.published_at ?? '').localeCompare(String(left.published_at ?? ''))
      || right.likes - left.likes
      || right.results_count - left.results_count;
  }
}
