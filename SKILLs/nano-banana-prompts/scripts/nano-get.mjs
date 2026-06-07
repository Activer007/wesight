#!/usr/bin/env node
import {
  buildMatchReason,
  failJson,
  loadCache,
  loadPrompt,
  printJson,
  publicSourceUrl,
  readArgs,
  toCandidate,
} from './nano-cache-lib.mjs';

const args = readArgs();
const id = typeof args.id === 'string' ? args.id : '';
if (!id) {
  failJson('missing_id', 'Prompt id is required.');
}

const cache = loadCache(args);
const indexItem = cache.items.find((item) => item.id === id);
const prompt = loadPrompt(cache, id);

printJson({
  success: true,
  item: toCandidate(
    indexItem || prompt,
    buildMatchReason([], 'Exact Nano prompt id match.'),
    prompt,
  ),
  prompt: {
    id: prompt.id,
    title: prompt.title,
    description: prompt.description,
    source: prompt.sourcePlatform || prompt.sourceId,
    author: prompt.author?.name || indexItem?.authorName || null,
    sourceUrl: publicSourceUrl(prompt.sourceLink),
    matchReason: 'Exact Nano prompt id match.',
    content: prompt.content,
    translatedContent: prompt.translatedContent || null,
    tags: prompt.tags || [],
    tagsZh: prompt.tagsZh || [],
    promptCategories: prompt.promptCategories || [],
    media: prompt.media || [],
    mediaThumbnails: prompt.mediaThumbnails || [],
    needReferenceImages: Boolean(prompt.needReferenceImages),
    likes: Number(prompt.likes ?? 0),
    resultsCount: Number(prompt.resultsCount ?? 0),
    provenance: {
      nano: {
        sourceId: prompt.sourceId,
        promptId: prompt.id,
        sourcePromptId: prompt.sourcePromptId,
        sourceUrl: publicSourceUrl(prompt.sourceLink),
        sourcePlatform: prompt.sourcePlatform || null,
        sourcePublishedAt: prompt.sourcePublishedAt || null,
        authorName: prompt.author?.name || null,
        authorLink: publicSourceUrl(prompt.author?.link),
      },
    },
  },
});
