import type { NanoBananaPrompt } from '@shared/nanoBanana/types';

import { i18nService } from '../services/i18n';
import type {
  CreatorCreativeDirection,
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

const buildNanoCreativeDirections = (
  prompt: NanoBananaPrompt,
  spec: CreatorPromptSpec,
): CreatorCreativeDirection[] => {
  const topic = prompt.title || spec.subject || spec.sourceTitle;
  const styleText = [...prompt.tags, ...prompt.tagsZh, ...prompt.promptCategories].slice(0, 5).join(', ');
  if (spec.language === 'zh') {
    return [
      {
        id: 'nano-hero-variant',
        title: '主视觉强化',
        template: '单一强主角 + 高识别度构图',
        style: styleText || spec.visualStyle || '高质量视觉主图',
        reason: `把「${topic}」重构为可直接用于项目主视觉的版本。`,
        promptFocus: '保留 Nano 的视觉张力，但重新定义主体、前后景层次、光线方向和画面留白。',
      },
      {
        id: 'nano-editorial-variant',
        title: '编辑叙事版',
        template: '杂志式场景 + 叙事细节',
        style: 'editorial, cinematic, crafted details',
        reason: '适合探索更强的故事感和内容传播语境。',
        promptFocus: '加入场景线索、人物或物件关系、环境材质和情绪转折，不复述原 prompt 文本。',
      },
      {
        id: 'nano-product-variant',
        title: '产品落地版',
        template: '商业产品图 + 可执行版式',
        style: 'commercial visual, clean composition, production-ready',
        reason: '适合把灵感转换成可复用的品牌、商品或活动素材。',
        promptFocus: '强调品牌可替换区域、产品呈现、清晰背景和可裁切构图。',
      },
      {
        id: 'nano-experimental-variant',
        title: '实验风格版',
        template: '反差材质 + 非常规镜头',
        style: 'experimental art direction, bold texture, unexpected camera angle',
        reason: '用于测试模型对风格、材质和构图边界的表现力。',
        promptFocus: '改变镜头距离、材质组合和色彩关系，产出与原 prompt 明显不同的探索稿。',
      },
    ];
  }
  return [
    {
      id: 'nano-hero-variant',
      title: 'Hero visual variant',
      template: 'single strong subject with recognizable composition',
      style: styleText || spec.visualStyle || 'high-quality hero visual',
      reason: `Reframes "${topic}" as a project-ready hero visual.`,
      promptFocus: 'Keep the Nano visual energy while redefining subject hierarchy, foreground/background depth, lighting direction, and negative space.',
    },
    {
      id: 'nano-editorial-variant',
      title: 'Editorial narrative',
      template: 'magazine-like scene with narrative details',
      style: 'editorial, cinematic, crafted details',
      reason: 'Explores story, context, and shareable editorial mood.',
      promptFocus: 'Add scene cues, object or character relationships, material detail, and mood shifts instead of restating the original prompt.',
    },
    {
      id: 'nano-product-variant',
      title: 'Commercial adaptation',
      template: 'commercial product visual with executable layout',
      style: 'commercial visual, clean composition, production-ready',
      reason: 'Turns the inspiration into a reusable brand, product, or campaign asset.',
      promptFocus: 'Emphasize replaceable brand zones, product presentation, clean backgrounds, and crop-safe composition.',
    },
    {
      id: 'nano-experimental-variant',
      title: 'Experimental style',
      template: 'contrasting materials with an unconventional camera angle',
      style: 'experimental art direction, bold texture, unexpected camera angle',
      reason: 'Tests the model boundary for style, material, and composition.',
      promptFocus: 'Change lens distance, material pairing, and color relationships to produce a clearly different exploration.',
    },
  ];
};

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
  const basePromptSpec = buildPromptSpec(seed, form, language, blankSourceTitle);
  const promptSpec = {
    ...basePromptSpec,
    creativeDirections: buildNanoCreativeDirections(prompt, basePromptSpec),
  };

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
