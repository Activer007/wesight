import type { NanoBananaPrompt } from '@shared/nanoBanana/types';

import { i18nService } from '../services/i18n';
import type {
  CreatorPromptReferenceAnalysis,
  CreatorPromptSpec,
  CreatorTemplateFieldSchema,
} from '../types/creatorStudio';
import { CreatorPromptSourceMode, CreatorStudioSourceType, CreatorTemplateFieldKind } from '../types/creatorStudio';
import type {
  CreatorPromptForm,
  CreatorPromptSeed,
} from './creatorStudio';
import { buildPromptSpec, normalizePromptLanguage } from './creatorStudio';

const AspectRatioCandidates = ['1:1', '4:5', '9:16', '16:9', '2:3', '3:4'] as const;

interface ParsedVariable {
  id: string;
  label: string;
  defaultValue: string;
}

export interface NanoCreatorPromptSpecConversion {
  seed: CreatorPromptSeed;
  form: CreatorPromptForm;
  promptSpec: CreatorPromptSpec;
  promptText: string;
  variables: ParsedVariable[];
  licenseNote: string;
  usageNote: string;
}

const normalizeVariableId = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'variable'
);

const uniqueVariables = (variables: ParsedVariable[]): ParsedVariable[] => {
  const seen = new Set<string>();
  return variables.filter((variable) => {
    if (seen.has(variable.id)) return false;
    seen.add(variable.id);
    return true;
  });
};

export const parseNanoPromptVariables = (content: string): ParsedVariable[] => {
  const argumentVariables = Array.from(content.matchAll(/\{argument\s+([^}]+)\}/gi))
    .map((match) => {
      const attrs = match[1];
      const name = attrs.match(/name=["']([^"']+)["']/i)?.[1]
        ?? attrs.match(/name=([^\s}]+)/i)?.[1]
        ?? '';
      const defaultValue = attrs.match(/default=["']([^"']*)["']/i)?.[1]
        ?? attrs.match(/default=([^\s}]+)/i)?.[1]
        ?? '';
      if (!name.trim()) return null;
      return {
        id: normalizeVariableId(name),
        label: name.trim(),
        defaultValue,
      };
    })
    .filter((item): item is ParsedVariable => item !== null);

  const placeholderVariables = Array.from(content.matchAll(/\[([A-Z][A-Z0-9 _-]{2,})\]/g))
    .map((match) => {
      const label = match[1].trim();
      return {
        id: normalizeVariableId(label),
        label,
        defaultValue: '',
      };
    });

  return uniqueVariables([...argumentVariables, ...placeholderVariables]);
};

export const parseNanoPromptAspectRatio = (content: string): string => (
  AspectRatioCandidates.find((ratio) => new RegExp(`(^|[^\\d])${ratio.replace(':', '\\s*[:/]\\s*')}([^\\d]|$)`, 'i').test(content))
  ?? ''
);

const createTemplateFieldSchema = (variables: ParsedVariable[]): CreatorTemplateFieldSchema[] => (
  variables.map((variable) => ({
    id: variable.id,
    kind: CreatorTemplateFieldKind.Text,
    label: {
      zh: variable.label,
      en: variable.label,
    },
    placeholder: {
      zh: variable.defaultValue,
      en: variable.defaultValue,
    },
  }))
);

const createReferenceAnalysis = (
  prompt: NanoBananaPrompt,
  aspectRatio: string,
): CreatorPromptReferenceAnalysis => ({
  aspectRatio,
  structure: [
    prompt.needReferenceImages ? i18nService.t('nanoCreatorReferenceNeedsImages') : i18nService.t('nanoCreatorReferenceTextOnly'),
    ...prompt.promptCategories.slice(0, 4),
  ].filter(Boolean),
  styleNotes: [...prompt.tags, ...prompt.tagsZh].slice(0, 8),
  textNotes: prompt.translatedContent ? [i18nService.t('nanoCreatorHasTranslation')] : [],
  constraintNotes: [
    prompt.sourcePlatform ? `${i18nService.t('nanoLibrarySource')}: ${prompt.sourcePlatform}` : '',
    prompt.needReferenceImages ? i18nService.t('nanoCreatorNeedReferenceLint') : '',
  ].filter(Boolean),
});

export const nanoPromptToCreatorPromptSpec = (
  prompt: NanoBananaPrompt,
  blankSourceTitle = i18nService.t('creatorBlankBuilder'),
): NanoCreatorPromptSpecConversion => {
  const variables = parseNanoPromptVariables(prompt.content);
  const aspectRatio = parseNanoPromptAspectRatio([
    prompt.title,
    prompt.description,
    prompt.content,
    prompt.translatedContent ?? '',
    prompt.searchIndex,
  ].join('\n'));
  const language = normalizePromptLanguage(i18nService.getLanguage(), {
    taskType: '',
    subject: prompt.title,
    platform: prompt.sourcePlatform ?? '',
    audience: '',
    mainObject: prompt.description,
    requiredText: '',
    visualStyle: [...prompt.tags, ...prompt.tagsZh, ...prompt.promptCategories].slice(0, 10).join(', '),
    colorPreference: '',
    aspectRatio: aspectRatio || '1:1',
    outputCount: '1',
    negativeRequirements: prompt.needReferenceImages ? i18nService.t('nanoCreatorNeedReferenceLint') : '',
    templateFieldValues: Object.fromEntries(variables.map((variable) => [variable.id, variable.defaultValue])),
  });
  const licenseNote = i18nService.t('nanoCreatorLicenseNote');
  const usageNote = prompt.needReferenceImages
    ? i18nService.t('nanoCreatorUsageNeedsReference')
    : i18nService.t('nanoCreatorUsageNote');
  const seed: CreatorPromptSeed = {
    sourceType: CreatorStudioSourceType.NanoPrompt,
    sourceMode: CreatorPromptSourceMode.NanoRemix,
    sourceId: prompt.id,
    sourceTitle: prompt.title,
    referencePrompt: prompt.content,
    category: prompt.promptCategories[0],
    styles: [...prompt.tags, ...prompt.tagsZh].slice(0, 12),
    scenes: prompt.promptCategories,
    caseIds: [],
    templateFieldSchema: createTemplateFieldSchema(variables),
    referenceAnalysis: createReferenceAnalysis(prompt, aspectRatio),
    provenance: {
      templateId: null,
      caseIds: [],
      variantOfAssetId: null,
      nano: {
        sourceId: prompt.sourceId,
        promptId: prompt.id,
        sourcePromptId: prompt.sourcePromptId,
        sourceUrl: prompt.sourceLink ?? null,
        sourcePlatform: prompt.sourcePlatform ?? null,
        sourcePublishedAt: prompt.sourcePublishedAt ?? null,
        authorName: prompt.author?.name ?? null,
        authorLink: prompt.author?.link ?? null,
        title: prompt.title,
        media: prompt.media,
        mediaThumbnails: prompt.mediaThumbnails,
        tags: prompt.tags,
        tagsZh: prompt.tagsZh,
        promptCategories: prompt.promptCategories,
        needReferenceImages: prompt.needReferenceImages,
        licenseNote,
        usageNote,
      },
    },
  };
  const form: CreatorPromptForm = {
    taskType: i18nService.t('nanoCreatorDefaultTaskType'),
    subject: prompt.title,
    platform: prompt.sourcePlatform ?? '',
    audience: '',
    mainObject: prompt.description,
    requiredText: '',
    visualStyle: [...prompt.tags, ...prompt.tagsZh, ...prompt.promptCategories].slice(0, 10).join(', '),
    colorPreference: '',
    aspectRatio: aspectRatio || '1:1',
    outputCount: '1',
    negativeRequirements: prompt.needReferenceImages ? i18nService.t('nanoCreatorNeedReferenceLint') : '',
    templateFieldValues: Object.fromEntries(variables.map((variable) => [variable.id, variable.defaultValue])),
  };
  const promptSpec = buildPromptSpec(seed, form, language, blankSourceTitle);

  return {
    seed,
    form,
    promptSpec,
    promptText: prompt.content,
    variables,
    licenseNote,
    usageNote,
  };
};
