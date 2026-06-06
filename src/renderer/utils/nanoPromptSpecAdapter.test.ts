import type { NanoBananaPrompt } from '@shared/nanoBanana/types';
import { describe, expect, test } from 'vitest';

import { CreatorPromptSourceMode, CreatorStudioSourceType } from '../types/creatorStudio';
import {
  nanoPromptToCreatorPromptSpec,
  parseNanoPromptAspectRatio,
  parseNanoPromptVariables,
} from './nanoPromptSpecAdapter';

const createNanoPrompt = (overrides: Partial<NanoBananaPrompt> = {}): NanoBananaPrompt => ({
  id: 'nano-supai:6845',
  sourceId: 'nano-supai',
  sourcePromptId: '6845',
  title: 'Editorial portrait prompt',
  description: 'A structured portrait prompt.',
  content: 'Create a 4:5 portrait for [BRAND NAME] with {argument name="headline" default="NEW DROP"}.',
  translatedContent: '创建一张 4:5 肖像。',
  sourceLink: 'https://example.com/source',
  sourcePlatform: 'x',
  sourcePublishedAt: '2026-01-22T12:29:35Z',
  author: {
    name: 'Nano Author',
    link: 'https://example.com/author',
  },
  media: ['https://example.com/image.jpg'],
  mediaThumbnails: ['https://example.com/thumb.jpg'],
  language: 'en',
  searchIndex: 'portrait editorial 4:5',
  likes: 10,
  resultsCount: 2,
  needReferenceImages: true,
  promptCategories: ['portrait'],
  tags: ['editorial'],
  tagsZh: ['编辑感'],
  page: 1,
  raw: {},
  ...overrides,
});

describe('nano prompt spec adapter', () => {
  test('parses Nano variables and aspect ratio', () => {
    expect(parseNanoPromptVariables('Use [BRAND NAME] and {argument name="headline" default="NEW DROP"}')).toEqual([
      { id: 'headline', label: 'headline', defaultValue: 'NEW DROP' },
      { id: 'brand_name', label: 'BRAND NAME', defaultValue: '' },
    ]);
    expect(parseNanoPromptAspectRatio('Generate a cinematic 16:9 frame.')).toBe('16:9');
  });

  test('converts Nano prompt to Creator seed, form, and provenance', () => {
    const conversion = nanoPromptToCreatorPromptSpec(createNanoPrompt(), 'Blank builder');

    expect(conversion.seed.sourceType).toBe(CreatorStudioSourceType.NanoPrompt);
    expect(conversion.seed.sourceMode).toBe(CreatorPromptSourceMode.NanoRemix);
    expect(conversion.form.aspectRatio).toBe('4:5');
    expect(conversion.form.templateFieldValues.headline).toBe('NEW DROP');
    expect(conversion.promptSpec.provenance?.nano).toMatchObject({
      sourceId: 'nano-supai',
      sourcePromptId: '6845',
      sourceUrl: 'https://example.com/source',
      needReferenceImages: true,
    });
    expect(conversion.promptSpec.templateFieldSchema?.[0].id).toBe('headline');
  });
});
