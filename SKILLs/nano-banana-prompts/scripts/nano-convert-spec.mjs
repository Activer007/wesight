#!/usr/bin/env node
import {
  failJson,
  loadCache,
  loadPrompt,
  parseAspectRatio,
  parseVariables,
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
const variables = parseVariables(prompt.content);
const aspectRatio = parseAspectRatio([
  prompt.title,
  prompt.description,
  prompt.content,
  prompt.translatedContent || '',
  prompt.searchIndex || '',
].join('\n'));
const styles = [
  ...(prompt.tags || []),
  ...(prompt.tagsZh || []),
  ...(prompt.promptCategories || []),
].slice(0, 12);
const sourceUrl = publicSourceUrl(prompt.sourceLink);
const licenseNote = 'Review the original Nano prompt source before commercial use.';
const usageNote = prompt.needReferenceImages
  ? 'This Nano prompt expects reference images; provide suitable references before running generation.'
  : 'Use as a remixable visual prompt source in Creator Studio.';

const promptSpec = {
  schemaVersion: 'creator-prompt-spec.nano-skill.v1',
  sourceType: 'nano_prompt',
  sourceMode: 'nano_remix',
  sourceId: prompt.id,
  sourceTitle: prompt.title,
  taskType: 'image_generation',
  subject: prompt.title,
  mainObject: prompt.description,
  visualStyle: styles.join(', '),
  aspectRatio,
  outputCount: 1,
  promptText: prompt.content,
  translatedText: prompt.translatedContent || null,
  variables,
  templateFieldSchema: variables.map((variable) => ({
    id: variable.id,
    kind: 'text',
    label: {
      zh: variable.label,
      en: variable.label,
    },
    placeholder: {
      zh: variable.defaultValue,
      en: variable.defaultValue,
    },
  })),
  lintHints: [
    prompt.needReferenceImages ? 'need_reference_images' : null,
  ].filter(Boolean),
  creativeDirections: [
    {
      id: 'nano-hero-variant',
      title: 'Hero visual variant',
      template: 'single strong subject with recognizable composition',
      style: styles.join(', ') || 'high-quality hero visual',
      reason: 'Reframes the Nano prompt as a project-ready hero visual.',
      promptFocus: 'Keep the Nano visual energy while redefining subject hierarchy, lighting, depth, and crop-safe negative space.',
    },
    {
      id: 'nano-editorial-variant',
      title: 'Editorial narrative',
      template: 'magazine-like scene with narrative details',
      style: 'editorial, cinematic, crafted details',
      reason: 'Adds story, context, and shareable editorial mood.',
      promptFocus: 'Add scene cues, object relationships, material detail, and mood shifts instead of restating the original prompt.',
    },
    {
      id: 'nano-product-variant',
      title: 'Commercial adaptation',
      template: 'commercial product visual with executable layout',
      style: 'commercial visual, clean composition, production-ready',
      reason: 'Turns the inspiration into a reusable brand, product, or campaign asset.',
      promptFocus: 'Emphasize replaceable brand zones, product presentation, clear backgrounds, and crop-safe composition.',
    },
    {
      id: 'nano-experimental-variant',
      title: 'Experimental style',
      template: 'contrasting materials with an unconventional camera angle',
      style: 'experimental art direction, bold texture, unexpected camera angle',
      reason: 'Tests style, material, and composition boundaries.',
      promptFocus: 'Change lens distance, material pairing, and color relationships to produce a clearly different exploration.',
    },
  ],
  provenance: {
    nano: {
      sourceId: prompt.sourceId,
      promptId: prompt.id,
      sourcePromptId: prompt.sourcePromptId,
      sourceUrl,
      sourcePlatform: prompt.sourcePlatform || null,
      sourcePublishedAt: prompt.sourcePublishedAt || null,
      authorName: prompt.author?.name || indexItem?.authorName || null,
      authorLink: publicSourceUrl(prompt.author?.link),
      title: prompt.title,
      media: prompt.media || [],
      mediaThumbnails: prompt.mediaThumbnails || [],
      tags: prompt.tags || [],
      tagsZh: prompt.tagsZh || [],
      promptCategories: prompt.promptCategories || [],
      needReferenceImages: Boolean(prompt.needReferenceImages),
      licenseNote,
      usageNote,
    },
  },
};

printJson({
  success: true,
  item: toCandidate(indexItem || prompt, 'Converted Nano prompt into Creator PromptSpec.', prompt),
  promptSpec,
  warnings: prompt.needReferenceImages
    ? ['Nano prompt requires reference images.']
    : [],
});
