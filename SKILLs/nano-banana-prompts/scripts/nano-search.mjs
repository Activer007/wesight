#!/usr/bin/env node
import {
  buildMatchReason,
  loadCache,
  parseLimit,
  printJson,
  readArgs,
  scoreItem,
  toCandidate,
  tokenize,
} from './nano-cache-lib.mjs';

const args = readArgs();
const query = typeof args.query === 'string' ? args.query : '';
const limit = parseLimit(args.limit, 6);
const cache = loadCache(args);
const terms = tokenize(query);

const scored = cache.items
  .map((item) => {
    const scoredItem = scoreItem(item, terms);
    return {
      item,
      score: query.trim() ? scoredItem.score : Number(item.likes ?? 0) + Number(item.resultsCount ?? 0) / 5,
      matchedTerms: scoredItem.matchedTerms,
    };
  })
  .filter((entry) => !query.trim() || entry.matchedTerms.length > 0)
  .sort((left, right) => right.score - left.score || String(right.item.publishedAt ?? '').localeCompare(String(left.item.publishedAt ?? '')))
  .slice(0, limit);

printJson({
  success: true,
  sourceId: cache.index.source?.id ?? null,
  query,
  totalItems: scored.length,
  items: scored.map((entry) => toCandidate(
    entry.item,
    buildMatchReason(entry.matchedTerms, 'Strong Nano prompt popularity and visual metadata fit.'),
  )),
});
