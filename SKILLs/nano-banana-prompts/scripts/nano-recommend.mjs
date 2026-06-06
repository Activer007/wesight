#!/usr/bin/env node
import {
  buildMatchReason,
  failJson,
  loadCache,
  parseLimit,
  printJson,
  readArgs,
  scoreItem,
  toCandidate,
  visualBriefTerms,
} from './nano-cache-lib.mjs';

const args = readArgs();
const brief = typeof args.brief === 'string' ? args.brief : '';
if (!brief.trim()) {
  failJson('missing_brief', 'Visual brief is required.');
}

const limit = Math.max(3, Math.min(parseLimit(args.limit, 6), 6));
const cache = loadCache(args);
const terms = visualBriefTerms(brief);

const scored = cache.items
  .map((item) => {
    const scoredItem = scoreItem(item, terms);
    const formatBoost = /公众号|头图|封面|banner|cover|hero/i.test(brief)
      && /cover|hero|banner|poster|封面|海报|主视觉|头图/i.test([
        item.title,
        item.description,
        item.searchTerms,
        (item.categories || []).join(' '),
      ].join(' '))
      ? 16
      : 0;
    const techBoost = /科技|tech|future|未来|科幻/i.test(brief)
      && /tech|technology|future|futuristic|sci-fi|cyber|科技|未来|科幻|数字/i.test([
        item.title,
        item.description,
        item.searchTerms,
        (item.categories || []).join(' '),
      ].join(' '))
      ? 18
      : 0;
    return {
      item,
      score: scoredItem.score + formatBoost + techBoost,
      matchedTerms: scoredItem.matchedTerms,
    };
  })
  .filter((entry) => entry.score > 0)
  .sort((left, right) => right.score - left.score || Number(right.item.likes ?? 0) - Number(left.item.likes ?? 0))
  .slice(0, limit);

const fallback = scored.length >= 3
  ? scored
  : cache.items
    .slice()
    .sort((left, right) => Number(right.likes ?? 0) - Number(left.likes ?? 0) || Number(right.resultsCount ?? 0) - Number(left.resultsCount ?? 0))
    .slice(0, limit)
    .map((item) => ({ item, score: Number(item.likes ?? 0), matchedTerms: [] }));

printJson({
  success: true,
  sourceId: cache.index.source?.id ?? null,
  brief,
  count: fallback.length,
  items: fallback.map((entry) => toCandidate(
    entry.item,
    buildMatchReason(entry.matchedTerms, 'High-performing visual prompt candidate for the requested brief.'),
  )),
});
