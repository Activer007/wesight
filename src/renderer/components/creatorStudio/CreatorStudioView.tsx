import {
  ArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpIcon,
  Bars3Icon,
  ClipboardDocumentIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  RocketLaunchIcon,
  SparklesIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  CreatorAssetAdoptionStatus,
  CreatorBatchTaskStatus,
  CreatorBoardCardKind,
  CreatorCoworkAction,
  CreatorImageAssetQuality,
  CreatorImageMetadataStatus,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingTaskStatus,
  CreatorLocalImageImportMode,
  CreatorProductionAssetKind,
  CreatorProductionAssetSource,
  CreatorProductionAssetStatus,
  CreatorStudioDefaultProjectId,
} from '@shared/creatorStudio/constants';
import type {
  CreatorImageJobListResult,
  CreatorImageOutputRevealInput,
} from '@shared/creatorStudio/imageProcessingTypes';
import type {
  CreatorBatchRunCreateInput,
  CreatorBatchRunRecord,
  CreatorBatchTaskRecord,
  CreatorBoardWorkspaceSnapshot,
  CreatorBrandKitRecord,
  CreatorCreativeModelCapability,
  CreatorProductionAssetRecord,
  CreatorPromptSpecSnapshot,
  CreatorRecipeRecord,
  CreatorStudioMessageMetadata,
  CreatorWorkspaceSnapshot,
} from '@shared/creatorStudio/types';
import {
  NanoBananaPromptImportType,
  NanoBananaUsageEventType,
} from '@shared/nanoBanana/constants';
import type { NanoBananaPrompt } from '@shared/nanoBanana/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { DeliveryMode, PayloadKind, ScheduleKind, SessionTarget, WakeMode } from '../../../scheduledTask/constants';
import casesData from '../../data/creatorStudio/cases.json';
import styleLibraryData from '../../data/creatorStudio/style-library.json';
import { creatorStudioAssetService } from '../../services/creatorStudioAssets';
import { i18nService } from '../../services/i18n';
import { nanoBananaService } from '../../services/nanoBanana';
import { scheduledTaskService } from '../../services/scheduledTask';
import { skillService } from '../../services/skill';
import { RootState } from '../../store';
import { setActiveSkillIds, setSkills } from '../../store/slices/skillSlice';
import type {
  CreatorBuilderMaterial,
  CreatorMaterialImageAnalysis,
  CreatorPromptReferenceAnalysis,
  CreatorPromptSpec,
  CreatorStudioCase,
  CreatorStudioStyleLibrary,
  CreatorStudioTemplate,
  CreatorTemplateFieldSchema,
} from '../../types/creatorStudio';
import { CreatorMaterialRole, CreatorMaterialSource, CreatorPromptSourceMode, CreatorStudioSourceType, CreatorTemplateFieldKind } from '../../types/creatorStudio';
import { applyCreatorBriefAutofill } from '../../utils/creatorBriefAutofill';
import {
  buildCreatorProductionPackage,
  CreatorProductionPackageIssueSeverity,
  type CreatorProductionPackageSummary,
  type CreatorProductionPerformanceGroup,
  summarizeCreatorProductionPackage,
} from '../../utils/creatorProductionPackage';
import { compileCreatorPrompt, CreatorPromptCompileTarget } from '../../utils/creatorPromptCompiler';
import { CreatorPromptLintSeverity, lintCreatorPromptSpec } from '../../utils/creatorPromptLint';
import { reverseEngineerCreatorPrompt } from '../../utils/creatorPromptReverseEngineer';
import { toCreatorPromptSpecSnapshot } from '../../utils/creatorPromptSpecAdapter';
import {
  buildPromptSpec,
  CREATOR_MATERIAL_ROLE_LABELS,
  CREATOR_STUDIO_RECOMMENDED_SKILL_IDS,
  type CreatorPromptForm,
  type CreatorPromptSeed,
  CreatorStudioRecommendedSkillId,
  hasSeedreamApiConfig,
  normalizePromptLanguage,
  renderCreatorPrompt,
  selectCreatorCreativeDirection,
} from '../../utils/creatorStudio';
import { getCreatorTemplateFieldSchema } from '../../utils/creatorTemplateFields';
import {
  type NanoCreatorPromptSpecConversion,
  nanoPromptToCreatorPromptSpec,
} from '../../utils/nanoPromptSpecAdapter';

const cases = casesData as CreatorStudioCase[];
const styleLibrary = styleLibraryData as CreatorStudioStyleLibrary;

const CreatorAssetGrid = React.lazy(() => import('./CreatorAssetGrid').then((module) => ({ default: module.CreatorAssetGrid })));
const CreatorBatchPanel = React.lazy(() => import('./CreatorBatchPanel').then((module) => ({ default: module.CreatorBatchPanel })));
const CreatorBoard = React.lazy(() => import('./CreatorBoard').then((module) => ({ default: module.CreatorBoard })));
const CreatorImageProcessingBatchPanel = React.lazy(() => import('./CreatorImageProcessingBatchPanel').then((module) => ({ default: module.CreatorImageProcessingBatchPanel })));
const ImageQuickEditDrawer = React.lazy(() => import('./ImageQuickEditDrawer').then((module) => ({ default: module.ImageQuickEditDrawer })));
const NanoLibraryView = React.lazy(() => import('./nano/NanoLibraryView').then((module) => ({ default: module.NanoLibraryView })));

const CreatorStudioTab = {
  Start: 'start',
  Inspiration: 'inspiration',
  Builder: 'builder',
  Assets: 'assets',
  ImageTools: 'image_tools',
  Board: 'board',
  Batch: 'batch',
} as const;

type CreatorStudioTab = typeof CreatorStudioTab[keyof typeof CreatorStudioTab];

const CreatorInspirationSubview = {
  Gallery: 'gallery',
  Templates: 'templates',
  NanoLibrary: 'nano_library',
} as const;

type CreatorInspirationSubview = typeof CreatorInspirationSubview[keyof typeof CreatorInspirationSubview];

const CreatorBatchSubview = {
  Generation: 'generation',
  ImageProcessing: 'image_processing',
} as const;

type CreatorBatchSubview = typeof CreatorBatchSubview[keyof typeof CreatorBatchSubview];

const CreatorStartAction = {
  GenerateImage: 'generate_image',
  ProcessImages: 'process_images',
  FindInspiration: 'find_inspiration',
} as const;

type CreatorStartAction = typeof CreatorStartAction[keyof typeof CreatorStartAction];

const CreatorImageToolBatchMode = {
  Webp: 'webp',
  Compress: 'compress',
  Resize: 'resize',
} as const;

type CreatorImageToolBatchMode = typeof CreatorImageToolBatchMode[keyof typeof CreatorImageToolBatchMode];

const CreatorImageToolTask = {
  QuickEdit: 'quick_edit',
  Compress: 'compress',
  Webp: 'webp',
  CoverResize: 'cover_resize',
  Inspect: 'inspect',
} as const;

type CreatorImageToolTask = typeof CreatorImageToolTask[keyof typeof CreatorImageToolTask];

const WINNING_ASSET_ADOPTION_STATUSES = new Set<string>([
  CreatorAssetAdoptionStatus.Adopted,
  CreatorAssetAdoptionStatus.Shortlisted,
  CreatorAssetAdoptionStatus.Favorite,
]);

const CreatorLazyFallback: React.FC = () => (
  <div className="flex min-h-56 items-center justify-center p-6 text-sm text-muted">
    {i18nService.t('creatorStudioLoadingSection')}
  </div>
);

interface CreatorStudioViewProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onSendToCowork: (draft: string, options: CreatorCoworkSendOptions) => void | Promise<void>;
  onOpenCoworkSession: (sessionId: string) => Promise<boolean>;
  updateBadge?: React.ReactNode;
}

interface CreatorCoworkSendOptions {
  activeSkillIds: string[];
  preferCreativeProducer?: boolean;
  attachments?: CreatorCoworkDraftAttachment[];
  messageMetadata?: Record<string, unknown>;
}

interface CreatorCoworkDraftAttachment {
  path: string;
  name: string;
  isImage?: boolean;
  dataUrl?: string;
}

const SeedreamStatus = {
  Missing: 'missing',
  Checking: 'checking',
  NeedsConfig: 'needs_config',
  Configured: 'configured',
} as const;

type SeedreamStatus = typeof SeedreamStatus[keyof typeof SeedreamStatus];

const PromptBuilderPreviewTab = {
  Prompt: 'prompt',
  Spec: 'spec',
} as const;

type PromptBuilderPreviewTab = typeof PromptBuilderPreviewTab[keyof typeof PromptBuilderPreviewTab];

const CASE_PAGE_SIZE = 80;
const GALLERY_THUMBNAIL_SIZE_MIN = 180;
const GALLERY_THUMBNAIL_SIZE_MAX = 360;
const GALLERY_THUMBNAIL_SIZE_STEP = 20;
const GALLERY_THUMBNAIL_SIZE_DEFAULT = 260;

const defaultBuilderForm: CreatorPromptForm = {
  taskType: '',
  subject: '',
  platform: '',
  audience: '',
  mainObject: '',
  requiredText: '',
  visualStyle: '',
  colorPreference: '',
  aspectRatio: '1:1',
  outputCount: '1',
  negativeRequirements: '',
  templateFieldValues: {},
};

const CREATOR_START_SCENARIOS: Array<{
  id: string;
  labelKey: string;
  briefKey: string;
}> = [
  {
    id: 'social-cover',
    labelKey: 'creatorStartScenarioSocialCover',
    briefKey: 'creatorStartScenarioSocialCoverBrief',
  },
  {
    id: 'product-visual',
    labelKey: 'creatorStartScenarioProductVisual',
    briefKey: 'creatorStartScenarioProductVisualBrief',
  },
  {
    id: 'campaign-poster',
    labelKey: 'creatorStartScenarioCampaignPoster',
    briefKey: 'creatorStartScenarioCampaignPosterBrief',
  },
  {
    id: 'image-variant',
    labelKey: 'creatorStartScenarioImageVariant',
    briefKey: 'creatorStartScenarioImageVariantBrief',
  },
] as const;

const buildFormFromPromptSpec = (promptSpec: Partial<CreatorPromptSpec>): CreatorPromptForm => ({
  taskType: typeof promptSpec.taskType === 'string' ? promptSpec.taskType : '',
  subject: typeof promptSpec.subject === 'string' ? promptSpec.subject : '',
  platform: typeof promptSpec.platform === 'string' ? promptSpec.platform : '',
  audience: typeof promptSpec.audience === 'string' ? promptSpec.audience : '',
  mainObject: typeof promptSpec.mainObject === 'string' ? promptSpec.mainObject : '',
  requiredText: typeof promptSpec.constraints?.requiredText === 'string' ? promptSpec.constraints.requiredText : '',
  visualStyle: typeof promptSpec.visualStyle === 'string' ? promptSpec.visualStyle : '',
  colorPreference: typeof promptSpec.colorPreference === 'string' ? promptSpec.colorPreference : '',
  aspectRatio: typeof promptSpec.constraints?.aspectRatio === 'string' ? promptSpec.constraints.aspectRatio : '1:1',
  outputCount: typeof promptSpec.outputCount === 'string' ? promptSpec.outputCount : '1',
  negativeRequirements: typeof promptSpec.constraints?.negativeRequirements === 'string'
    ? promptSpec.constraints.negativeRequirements
    : '',
  templateFieldValues: promptSpec.templateFieldValues && typeof promptSpec.templateFieldValues === 'object'
    ? Object.fromEntries(
      Object.entries(promptSpec.templateFieldValues)
        .filter(([, value]) => typeof value === 'string')
    ) as Record<string, string>
    : {},
});

const dispatchToast = (message: string) => {
  window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
};

const getText = (value: { zh: string; en: string }) => value[i18nService.getLanguage()];

const getCreatorProjectLabel = (projectId: string, name: string): string => (
  projectId === CreatorStudioDefaultProjectId ? i18nService.t('creatorDefaultProject') : name
);

const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text);
  dispatchToast(i18nService.t('copied'));
};

const getNanoPromptMetadata = (prompt: NanoBananaPrompt): Record<string, unknown> => ({
  nano: {
    sourceId: prompt.sourceId,
    promptId: prompt.id,
    sourcePromptId: prompt.sourcePromptId,
    sourceUrl: prompt.sourceLink ?? null,
    sourcePlatform: prompt.sourcePlatform ?? null,
    authorName: prompt.author?.name ?? null,
    needReferenceImages: prompt.needReferenceImages,
  },
});

const getNanoBatchSizes = (aspectRatio?: string): string[] => (
  [...new Set([aspectRatio || '1:1', '16:9', '9:16'])].slice(0, 2)
);

const encodeTextBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const buildProductionPackageFileName = (projectName: string): string => {
  const safeProjectName = projectName.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'creator-project';
  return `${safeProjectName}-production-package.json`;
};

const CreatorRecipeAutomationDefaultCron = '0 9 * * *';

const buildRecipeAutomationPrompt = (recipe: CreatorRecipeRecord): string => (
  [
    i18nService.t('creatorRecipeAutomationPromptIntro'),
    '',
    `recipeId: ${recipe.id}`,
    `recipeTitle: ${recipe.title}`,
    `tags: ${recipe.tags.length > 0 ? recipe.tags.join(', ') : 'none'}`,
    '',
    'PromptSpec:',
    '```json',
    JSON.stringify(recipe.promptSpec, null, 2),
    '```',
    '',
    'Default runtime:',
    '```json',
    JSON.stringify(recipe.defaultRuntime, null, 2),
    '```',
    '',
    'Default output:',
    '```json',
    JSON.stringify(recipe.defaultOutput, null, 2),
    '```',
  ].join('\n')
);

const buildCreatorCoworkMessageMetadata = ({
  promptSpec,
  promptText,
  activeSkillIds,
  requestedAction,
  source,
}: {
  promptSpec?: CreatorPromptSpecSnapshot | CreatorPromptSpecSnapshot[] | null;
  promptText?: string;
  activeSkillIds: string[];
  requestedAction: CreatorCoworkAction;
  source?: CreatorStudioMessageMetadata['creatorStudio']['source'];
}): CreatorStudioMessageMetadata => {
  const normalizedSource = {
    studio: 'creator_studio',
    ...(source ?? {}),
  };
  return {
    creatorStudio: {
      schemaVersion: 'creator.cowork.v1',
      action: requestedAction,
      promptSpec: promptSpec ?? null,
      ...(promptText ? { promptText } : {}),
      activeSkillIds,
      source: normalizedSource,
    },
    domain: 'creator_studio',
    promptSpec: promptSpec ?? null,
    promptText,
    activeSkillIds,
    requestedAction,
    source: normalizedSource,
  };
};

const PlaceholderImage: React.FC<{
  src: string | null;
  alt: string;
  className?: string;
  fit?: 'cover' | 'contain';
}> = ({ src, alt, className = '', fit = 'cover' }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-raised text-muted ${className}`}>
        <PhotoIcon className="h-10 w-10" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${className}`}
    />
  );
};

const formatImageDimensions = (image: CreatorStudioCase['imageOriginal']): string => (
  image ? `${image.width} x ${image.height}` : i18nService.t('creatorImageUnknown')
);

const formatImageAspectRatio = (image: CreatorStudioCase['imageOriginal']): string => (
  image ? `${image.aspectRatio.toFixed(2)}:1` : i18nService.t('creatorImageUnknown')
);

const formatImageFileSize = (image: CreatorStudioCase['imageOriginal']): string => {
  if (!image) return i18nService.t('creatorImageUnknown');
  if (image.byteSize < 1024) return `${image.byteSize} B`;
  if (image.byteSize < 1024 * 1024) return `${(image.byteSize / 1024).toFixed(1)} KB`;
  return `${(image.byteSize / 1024 / 1024).toFixed(1)} MB`;
};

const getWinningAssetScore = (asset: CreatorProductionAssetRecord): number => {
  if (asset.adoptionStatus === CreatorAssetAdoptionStatus.Adopted) return 5;
  if (asset.selected) return 4;
  if (asset.adoptionStatus === CreatorAssetAdoptionStatus.Shortlisted) return 3;
  if (asset.favorite || asset.adoptionStatus === CreatorAssetAdoptionStatus.Favorite) return 2;
  return 0;
};

const resolveWinningBatchAsset = async (
  projectId: string,
  assetIds: string[]
): Promise<CreatorProductionAssetRecord | null> => {
  if (assetIds.length === 0) return null;
  const result = await creatorStudioAssetService.listAssets({ projectId, limit: 200 });
  const taskAssetIds = new Set(assetIds);
  const candidates = result.assets
    .filter((asset) => taskAssetIds.has(asset.id))
    .map((asset) => ({ asset, score: getWinningAssetScore(asset) }))
    .filter((item) => item.score > 0 || WINNING_ASSET_ADOPTION_STATUSES.has(item.asset.adoptionStatus))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.asset ?? null;
};

const CreatorStudioView: React.FC<CreatorStudioViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onSendToCowork,
  onOpenCoworkSession,
  updateBadge,
}) => {
  const dispatch = useDispatch();
  const skills = useSelector((state: RootState) => state.skill.skills);
  const [activeTab, setActiveTab] = useState<CreatorStudioTab>(CreatorStudioTab.Start);
  const [inspirationSubview, setInspirationSubview] = useState<CreatorInspirationSubview>(CreatorInspirationSubview.Gallery);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [style, setStyle] = useState('');
  const [scene, setScene] = useState('');
  const [selectedCase, setSelectedCase] = useState<CreatorStudioCase | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CreatorStudioTemplate | null>(null);
  const [builderSeed, setBuilderSeed] = useState<CreatorPromptSeed | null>(null);
  const [builderForm, setBuilderForm] = useState<CreatorPromptForm>(defaultBuilderForm);
  const [builderMaterials, setBuilderMaterials] = useState<CreatorBuilderMaterial[]>([]);
  const [visibleCaseCount, setVisibleCaseCount] = useState(CASE_PAGE_SIZE);
  const [seedreamStatus, setSeedreamStatus] = useState<SeedreamStatus>(SeedreamStatus.Missing);
  const [isSendingToCowork, setIsSendingToCowork] = useState(false);
  const [workspace, setWorkspace] = useState<CreatorWorkspaceSnapshot | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [boardWorkspace, setBoardWorkspace] = useState<CreatorBoardWorkspaceSnapshot | null>(null);
  const [boardContextPack, setBoardContextPack] = useState('');
  const [modelCapabilities, setModelCapabilities] = useState<CreatorCreativeModelCapability[]>([]);
  const [batchRuns, setBatchRuns] = useState<CreatorBatchRunRecord[]>([]);
  const [activeBatchRun, setActiveBatchRun] = useState<CreatorBatchRunRecord | null>(null);
  const [isCreatingBatchRun, setIsCreatingBatchRun] = useState(false);
  const [batchSubview, setBatchSubview] = useState<CreatorBatchSubview>(CreatorBatchSubview.Generation);
  const [imageProcessingJobs, setImageProcessingJobs] = useState<CreatorImageJobListResult['jobs']>([]);
  const [recipes, setRecipes] = useState<CreatorRecipeRecord[]>([]);
  const [projectAssets, setProjectAssets] = useState<CreatorProductionAssetRecord[]>([]);
  const [imageToolsInitialFilePaths, setImageToolsInitialFilePaths] = useState<string[]>([]);

  useEffect(() => {
    void skillService.loadSkills().then((loadedSkills) => {
      dispatch(setSkills(loadedSkills));
    });
  }, [dispatch]);

  const loadWorkspace = useCallback(async () => {
    const nextWorkspace = await creatorStudioAssetService.getWorkspace();
    setWorkspace(nextWorkspace);
    setCurrentProjectId(nextWorkspace.currentProjectId);
  }, []);

  const loadBoardWorkspace = useCallback(async (projectId: string) => {
    const nextWorkspace = await creatorStudioAssetService.getBoardWorkspace(projectId);
    setBoardWorkspace(nextWorkspace);
    return nextWorkspace;
  }, []);

  const loadBatchRuns = useCallback(async (projectId: string) => {
    const result = await creatorStudioAssetService.listBatchRuns({ projectId, limit: 20 });
    setBatchRuns(result.runs);
    setActiveBatchRun((current) => {
      if (!current) return result.runs[0] ?? null;
      return result.runs.find((run) => run.id === current.id) ?? result.runs[0] ?? null;
    });
  }, []);

  const loadImageProcessingJobs = useCallback(async (projectId: string) => {
    const result = await creatorStudioAssetService.listImageJobs({ projectId, limit: 20 });
    setImageProcessingJobs(result.jobs);
  }, []);

  const loadModelCapabilities = useCallback(async () => {
    const result = await creatorStudioAssetService.listModelCapabilities();
    setModelCapabilities(result);
    return result;
  }, []);

  const loadRecipes = useCallback(async (projectId: string) => {
    const result = await creatorStudioAssetService.listRecipes({ projectId, limit: 50 });
    setRecipes(result.recipes);
  }, []);

  const loadProjectAssets = useCallback(async (projectId: string) => {
    const result = await creatorStudioAssetService.listAssets({ projectId, limit: 200 });
    setProjectAssets(result.assets);
    return result.assets;
  }, []);

  useEffect(() => {
    void loadWorkspace().catch(() => {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
    });
  }, [loadWorkspace]);

  useEffect(() => {
    setBoardWorkspace(null);
    setBoardContextPack('');
    setBatchRuns([]);
    setActiveBatchRun(null);
    setImageProcessingJobs([]);
    setRecipes([]);
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId) return;
    if (activeTab !== CreatorStudioTab.Builder && activeTab !== CreatorStudioTab.Board) return;
    void loadBoardWorkspace(currentProjectId).catch(() => {
      dispatchToast(i18nService.t('creatorBoardLoadFailed'));
    });
  }, [activeTab, currentProjectId, loadBoardWorkspace]);

  useEffect(() => {
    if (activeTab !== CreatorStudioTab.Batch) return;
    void loadModelCapabilities()
      .catch(() => {
        dispatchToast(i18nService.t('creatorBatchModelLoadFailed'));
      });
  }, [activeTab, loadModelCapabilities]);

  useEffect(() => {
    if (!currentProjectId) return;
    if (activeTab !== CreatorStudioTab.Builder && activeTab !== CreatorStudioTab.Batch) return;
    void loadBatchRuns(currentProjectId).catch(() => {
      dispatchToast(i18nService.t('creatorBatchLoadFailed'));
    });
  }, [activeTab, currentProjectId, loadBatchRuns]);

  useEffect(() => {
    if (!currentProjectId) return;
    if (activeTab !== CreatorStudioTab.ImageTools && !(activeTab === CreatorStudioTab.Batch && batchSubview === CreatorBatchSubview.ImageProcessing)) return;
    void loadImageProcessingJobs(currentProjectId).catch(() => {
      dispatchToast(i18nService.t('creatorImageBatchLoadFailed'));
    });
  }, [activeTab, batchSubview, currentProjectId, loadImageProcessingJobs]);

  useEffect(() => {
    if (!currentProjectId || activeTab !== CreatorStudioTab.Batch || batchSubview !== CreatorBatchSubview.ImageProcessing) return undefined;
    const hasActiveImageJob = imageProcessingJobs.some(({ job, tasks }) => (
      job.status === CreatorImageProcessingJobStatus.Running
      || tasks.some((task) => (
        task.status === CreatorImageProcessingTaskStatus.Pending
        || task.status === CreatorImageProcessingTaskStatus.Running
      ))
    ));
    if (!hasActiveImageJob) return undefined;
    const timer = window.setInterval(() => {
      void loadImageProcessingJobs(currentProjectId).catch(() => {
        dispatchToast(i18nService.t('creatorImageBatchLoadFailed'));
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeTab, batchSubview, currentProjectId, imageProcessingJobs, loadImageProcessingJobs]);

  useEffect(() => {
    if (!currentProjectId) return;
    if (activeTab !== CreatorStudioTab.Builder && activeTab !== CreatorStudioTab.Assets) return;
    void loadRecipes(currentProjectId).catch(() => {
      dispatchToast(i18nService.t('creatorRecipeLoadFailed'));
    });
  }, [activeTab, currentProjectId, loadRecipes]);

  useEffect(() => {
    if (!currentProjectId) return;
    void loadProjectAssets(currentProjectId).catch(() => {
      dispatchToast(i18nService.t('creatorAssetsLoadFailed'));
    });
  }, [currentProjectId, loadProjectAssets]);

  const searchableLabels = useMemo(() => {
    const labels = new Map<string, string[]>();
    for (const categoryItem of styleLibrary.categories) {
      labels.set(categoryItem.value, [
        categoryItem.title.en,
        categoryItem.title.zh,
        categoryItem.description.en,
        categoryItem.description.zh,
      ]);
    }
    for (const styleItem of styleLibrary.styles) {
      labels.set(styleItem.value, [styleItem.title.en, styleItem.title.zh, ...styleItem.keywords]);
    }
    for (const sceneItem of styleLibrary.scenes) {
      labels.set(sceneItem.value, [sceneItem.title.en, sceneItem.title.zh, ...sceneItem.keywords]);
    }
    return labels;
  }, []);

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesQuery = !normalizedQuery || [
        item.title,
        item.prompt,
        item.sourceLabel,
        item.category,
        ...item.styles,
        ...item.scenes,
        ...item.tags,
        ...(searchableLabels.get(item.category) ?? []),
        ...item.styles.flatMap((tag) => searchableLabels.get(tag) ?? []),
        ...item.scenes.flatMap((tag) => searchableLabels.get(tag) ?? []),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesCategory = !category || item.category === category;
      const matchesStyle = !style || item.styles.includes(style);
      const matchesScene = !scene || item.scenes.includes(scene);
      return matchesQuery && matchesCategory && matchesStyle && matchesScene;
    });
  }, [category, query, scene, searchableLabels, style]);

  const templateCasesById = useMemo(() => new Map(cases.map((item) => [item.sourceCaseId, item])), []);
  const visibleCases = filteredCases.slice(0, visibleCaseCount);
  const installedRecommendedSkillIds = useMemo(() => {
    const availableSkillIds = new Set(skills.map((skill) => skill.id));
    return CREATOR_STUDIO_RECOMMENDED_SKILL_IDS.filter((skillId) => availableSkillIds.has(skillId));
  }, [skills]);
  const missingRecommendedSkillIds = useMemo(() => {
    const installed = new Set(installedRecommendedSkillIds);
    return CREATOR_STUDIO_RECOMMENDED_SKILL_IDS.filter((skillId) => !installed.has(skillId));
  }, [installedRecommendedSkillIds]);
  const builderPromptLanguage = useMemo(
    () => normalizePromptLanguage(i18nService.getLanguage(), builderForm),
    [builderForm]
  );
  const boardPromptSpec = useMemo(
    () => buildPromptSpec(builderSeed, builderForm, builderPromptLanguage, i18nService.t('creatorBlankBuilder'), builderMaterials),
    [builderForm, builderMaterials, builderPromptLanguage, builderSeed]
  );
  const boardPromptText = useMemo(() => renderCreatorPrompt(boardPromptSpec), [boardPromptSpec]);
  const batchPromptSpec = useMemo(
    () => applyBoardAndBrandKit(boardPromptSpec, boardWorkspace?.brandKit ?? null, boardContextPack),
    [boardContextPack, boardPromptSpec, boardWorkspace?.brandKit]
  );
  const batchPromptText = useMemo(() => renderCreatorPrompt(batchPromptSpec), [batchPromptSpec]);
  const currentProject = useMemo(
    () => workspace?.projects.find((project) => project.id === currentProjectId) ?? null,
    [currentProjectId, workspace?.projects]
  );
  const productionPackageSummary = useMemo<CreatorProductionPackageSummary>(() => (
    summarizeCreatorProductionPackage({
      projectId: currentProjectId,
      project: currentProject,
      assets: projectAssets,
      recipes,
      batchRuns,
    })
  ), [batchRuns, currentProject, currentProjectId, projectAssets, recipes]);

  useEffect(() => {
    let cancelled = false;
    const seedreamInstalled = skills.some((skill) => skill.id === CreatorStudioRecommendedSkillId.Seedream);
    if (!seedreamInstalled) {
      setSeedreamStatus(SeedreamStatus.Missing);
      return () => {
        cancelled = true;
      };
    }

    setSeedreamStatus(SeedreamStatus.Checking);
    void skillService.getSkillConfig(CreatorStudioRecommendedSkillId.Seedream)
      .then((config) => {
        if (cancelled) return;
        setSeedreamStatus(hasSeedreamApiConfig(config) ? SeedreamStatus.Configured : SeedreamStatus.NeedsConfig);
      })
      .catch(() => {
        if (cancelled) return;
        setSeedreamStatus(SeedreamStatus.NeedsConfig);
      });

    return () => {
      cancelled = true;
    };
  }, [skills]);

  useEffect(() => {
    setVisibleCaseCount(CASE_PAGE_SIZE);
  }, [category, query, scene, style]);

  const startFromCase = (item: CreatorStudioCase) => {
    const reverseEngineeredPrompt = reverseEngineerCreatorPrompt(item.prompt, item.title);
    setBuilderSeed({
      sourceType: CreatorStudioSourceType.Case,
      sourceMode: CreatorPromptSourceMode.CaseRemix,
      sourceId: item.id,
      sourceTitle: item.title,
      referencePrompt: item.prompt,
      caseIds: [item.id],
      category: item.category,
      styles: item.styles,
      scenes: item.scenes,
      referenceAnalysis: reverseEngineeredPrompt.analysis,
    });
    setBuilderForm({
      ...defaultBuilderForm,
      ...reverseEngineeredPrompt.formDraft,
      visualStyle: [
        ...item.styles,
        ...item.scenes,
        reverseEngineeredPrompt.formDraft.visualStyle,
      ].filter(Boolean).join(', '),
    });
    const caseImage = item.image;
    if (caseImage) {
      setBuilderMaterials((materials) => [{
        id: createMaterialId(),
        role: CreatorMaterialRole.Reference,
        source: CreatorMaterialSource.Case,
        name: item.title,
        path: caseImage,
        mimeType: item.imageThumbnail?.mimeType ?? item.imageOriginal?.mimeType ?? 'image/jpeg',
        size: item.imageThumbnail?.byteSize ?? 0,
        previewUrl: caseImage,
        assetQuality: CreatorImageAssetQuality.Thumbnail,
        originalUrl: item.imageOriginalUrl ?? null,
        thumbnailUrl: item.imageThumbnailPath ?? caseImage,
        imageAnalysis: item.imageOriginal
          ? {
            width: item.imageOriginal.width,
            height: item.imageOriginal.height,
            dominantColors: [],
            aspectRatio: `${item.imageOriginal.width}:${item.imageOriginal.height}`,
          }
          : undefined,
        addedAt: Date.now(),
      }, ...materials]);
    }
    setActiveTab(CreatorStudioTab.Builder);
  };

  const startFromTemplate = (template: CreatorStudioTemplate) => {
    setBuilderSeed({
      sourceType: CreatorStudioSourceType.Template,
      sourceMode: CreatorPromptSourceMode.TemplateDraft,
      sourceId: template.id,
      sourceTitle: getText(template.title),
      templateId: template.id,
      templateUseWhen: getText(template.useWhen),
      caseIds: template.exampleCases.map((sourceCaseId) => `case-${sourceCaseId}`),
      category: template.category,
      styles: template.styles,
      scenes: template.scenes,
      templateGuidance: template.guidance[i18nService.getLanguage()],
      templatePitfalls: template.pitfalls[i18nService.getLanguage()],
      templateFieldSchema: getCreatorTemplateFieldSchema(template),
    });
    setBuilderForm({
      ...defaultBuilderForm,
      visualStyle: [...template.styles, ...template.scenes].join(', '),
    });
    setActiveTab(CreatorStudioTab.Builder);
  };

  const openInspiration = (subview: CreatorInspirationSubview = CreatorInspirationSubview.Gallery) => {
    setInspirationSubview(subview);
    setActiveTab(CreatorStudioTab.Inspiration);
  };

  const openExampleCase = (sourceCaseId: number) => {
    const item = templateCasesById.get(sourceCaseId);
    if (!item) return;
    setSelectedTemplate(null);
    setSelectedCase(item);
    openInspiration(CreatorInspirationSubview.Gallery);
  };

  const useAssetAsReference = (asset: CreatorProductionAssetRecord) => {
    setBuilderSeed({
      sourceType: CreatorStudioSourceType.Template,
      sourceMode: CreatorPromptSourceMode.AssetVariant,
      sourceId: asset.id,
      sourceTitle: asset.fileName,
      referencePrompt: asset.promptText || (asset.promptSpec ? JSON.stringify(asset.promptSpec, null, 2) : undefined),
      templateId: asset.templateId ?? undefined,
      caseIds: asset.caseIds,
      category: typeof asset.promptSpec?.category === 'string' ? asset.promptSpec.category : undefined,
      styles: Array.isArray(asset.promptSpec?.styles) ? asset.promptSpec.styles : [],
      scenes: Array.isArray(asset.promptSpec?.scenes) ? asset.promptSpec.scenes : [],
      templateGuidance: Array.isArray(asset.promptSpec?.templateGuidance) ? asset.promptSpec.templateGuidance : [],
      templatePitfalls: Array.isArray(asset.promptSpec?.templatePitfalls) ? asset.promptSpec.templatePitfalls : [],
      variantOfAssetId: asset.id,
      provenance: asset.promptSpec?.provenance as CreatorPromptSpec['provenance'],
    });
    setBuilderForm({
      taskType: typeof asset.promptSpec?.taskType === 'string' ? asset.promptSpec.taskType : '',
      subject: asset.promptSpec?.subject ?? asset.fileName,
      platform: asset.promptSpec?.platform ?? '',
      audience: typeof asset.promptSpec?.audience === 'string' ? asset.promptSpec.audience : '',
      mainObject: asset.promptSpec?.mainObject ?? '',
      requiredText: asset.promptSpec?.constraints?.requiredText ?? '',
      visualStyle: asset.promptSpec?.visualStyle ?? '',
      colorPreference: typeof asset.promptSpec?.colorPreference === 'string' ? asset.promptSpec.colorPreference : '',
      aspectRatio: asset.promptSpec?.constraints?.aspectRatio ?? '1:1',
      outputCount: typeof asset.promptSpec?.outputCount === 'string' ? asset.promptSpec.outputCount : '1',
      negativeRequirements: asset.promptSpec?.constraints?.negativeRequirements ?? '',
      templateFieldValues: typeof asset.promptSpec?.templateFieldValues === 'object' && asset.promptSpec.templateFieldValues
        ? Object.fromEntries(
          Object.entries(asset.promptSpec.templateFieldValues)
            .filter(([, value]) => typeof value === 'string')
        ) as Record<string, string>
        : {},
    });
    if (asset.kind === CreatorProductionAssetKind.Image) {
      setBuilderMaterials((items) => [{
        id: createMaterialId(),
        role: CreatorMaterialRole.Reference,
        source: CreatorMaterialSource.File,
        name: asset.fileName,
        path: asset.filePath,
        mimeType: asset.mimeType || 'image/png',
        size: 0,
        previewUrl: encodeLocalFileSrc(asset.filePath),
        addedAt: Date.now(),
      }, ...items]);
    }
    setActiveTab(CreatorStudioTab.Builder);
  };

  const useRecipeInBuilder = (recipe: CreatorRecipeRecord) => {
    const promptSpec = recipe.promptSpec as Partial<CreatorPromptSpec>;
    setBuilderSeed({
      sourceType: CreatorStudioSourceType.Template,
      sourceMode: CreatorPromptSourceMode.RecipeDraft,
      sourceId: recipe.id,
      sourceTitle: recipe.title,
      templateId: typeof promptSpec.templateId === 'string' ? promptSpec.templateId : undefined,
      caseIds: Array.isArray(promptSpec.caseIds) ? promptSpec.caseIds : [],
      category: typeof promptSpec.category === 'string' ? promptSpec.category : undefined,
      styles: Array.isArray(promptSpec.styles) ? promptSpec.styles : [],
      scenes: Array.isArray(promptSpec.scenes) ? promptSpec.scenes : [],
      templateGuidance: Array.isArray(promptSpec.templateGuidance) ? promptSpec.templateGuidance : [],
      templatePitfalls: Array.isArray(promptSpec.templatePitfalls) ? promptSpec.templatePitfalls : [],
      provenance: promptSpec.provenance as CreatorPromptSpec['provenance'],
    });
    setBuilderForm(buildFormFromPromptSpec(promptSpec));
    setActiveTab(CreatorStudioTab.Builder);
  };

  const openBuilderSourceDetail = (seed: CreatorPromptSeed | null) => {
    if (!seed || !seed.sourceMode || seed.sourceMode === CreatorPromptSourceMode.Blank) return;
    if (seed.sourceMode === CreatorPromptSourceMode.CaseRemix) {
      const item = cases.find((caseItem) => caseItem.id === seed.sourceId);
      if (!item) return;
      setSelectedTemplate(null);
      setSelectedCase(item);
      openInspiration(CreatorInspirationSubview.Gallery);
      return;
    }
    if (seed.sourceMode === CreatorPromptSourceMode.TemplateDraft) {
      const template = styleLibrary.templates.find((item) => item.id === (seed.templateId ?? seed.sourceId));
      if (!template) return;
      setSelectedCase(null);
      setSelectedTemplate(template);
      openInspiration(CreatorInspirationSubview.Templates);
      return;
    }
    if (seed.sourceMode === CreatorPromptSourceMode.AssetVariant) {
      setActiveTab(CreatorStudioTab.Assets);
      return;
    }
    if (seed.sourceMode === CreatorPromptSourceMode.NanoRemix) {
      openInspiration(CreatorInspirationSubview.NanoLibrary);
    }
  };

  const sendAssetToCowork = async (asset: CreatorProductionAssetRecord) => {
    setIsSendingToCowork(true);
    try {
      dispatch(setActiveSkillIds(installedRecommendedSkillIds));
      const promptText = asset.promptText || (asset.promptSpec ? JSON.stringify(asset.promptSpec, null, 2) : '');
      const promptSpec = {
        ...(asset.promptSpec ?? {}),
        sourceTitle: asset.promptSpec?.sourceTitle ?? asset.fileName,
        templateId: asset.templateId ?? asset.promptSpec?.templateId,
        caseIds: asset.caseIds,
        variantOfAssetId: asset.id,
      };
      await onSendToCowork([
        '[Creator Studio]',
        '',
        i18nService.t('creatorAssetCoworkDraftIntro'),
        '',
        `assetId: ${asset.id}`,
        `templateId: ${asset.templateId || 'none'}`,
        `caseIds: ${asset.caseIds.length > 0 ? asset.caseIds.join(', ') : 'none'}`,
        `variantOfAssetId: ${asset.id}`,
        `localPath: ${asset.filePath}`,
        '',
        'PromptSpec:',
        '```json',
        JSON.stringify(promptSpec, null, 2),
        '```',
        '',
        'Prompt:',
        '```text',
        promptText,
        '```',
      ].join('\n'), {
        activeSkillIds: installedRecommendedSkillIds,
        preferCreativeProducer: true,
        messageMetadata: buildCreatorCoworkMessageMetadata({
          promptSpec,
          promptText,
          activeSkillIds: installedRecommendedSkillIds,
          requestedAction: CreatorCoworkAction.AssetVariant,
          source: {
            assetId: asset.id,
            sourceType: 'asset',
            templateId: asset.templateId,
            caseIds: asset.caseIds,
          },
        }),
      });
    } catch {
      dispatchToast(i18nService.t('creatorSendToCoworkFailed'));
    } finally {
      setIsSendingToCowork(false);
    }
  };

  const sendToCowork = async (
    promptSpec: CreatorPromptSpec,
    promptText: string,
    materials: CreatorBuilderMaterial[],
    requestImageGeneration = false
  ): Promise<boolean> => {
    setIsSendingToCowork(true);
    try {
      dispatch(setActiveSkillIds(installedRecommendedSkillIds));
      const compiled = compileCreatorPrompt({
        spec: promptSpec,
        target: CreatorPromptCompileTarget.CoworkDraft,
        materials,
        runtime: {
          installedSkillIds: installedRecommendedSkillIds,
          missingSkillIds: missingRecommendedSkillIds,
          requestImageGeneration,
        },
      });
      await onSendToCowork(compiled.draftText ?? promptText, {
        activeSkillIds: installedRecommendedSkillIds,
        preferCreativeProducer: true,
        attachments: compiled.attachments,
        messageMetadata: buildCreatorCoworkMessageMetadata({
          promptSpec: compiled.promptSpec,
          promptText: compiled.promptText,
          activeSkillIds: installedRecommendedSkillIds,
          requestedAction: requestImageGeneration ? CreatorCoworkAction.StartGeneration : CreatorCoworkAction.PromptDraft,
          source: {
            sourceType: promptSpec.sourceType,
            sourceMode: promptSpec.sourceMode,
            sourceId: promptSpec.sourceId,
            sourceTitle: promptSpec.sourceTitle,
            templateId: promptSpec.templateId,
            caseIds: promptSpec.caseIds,
          },
        }),
      });
      return true;
    } catch {
      dispatchToast(i18nService.t('creatorSendToCoworkFailed'));
      return false;
    } finally {
      setIsSendingToCowork(false);
    }
  };

  const createProject = async (name: string) => {
    if (!name.trim()) return;
    try {
      const nextWorkspace = await creatorStudioAssetService.createProject({ name: name.trim() });
      setWorkspace(nextWorkspace);
      setCurrentProjectId(nextWorkspace.currentProjectId);
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorProjectCreateFailed'));
      throw error;
    }
  };

  const switchProject = async (projectId: string) => {
    try {
      const nextWorkspace = await creatorStudioAssetService.setCurrentProject(projectId);
      setWorkspace(nextWorkspace);
      setCurrentProjectId(nextWorkspace.currentProjectId);
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorProjectSwitchFailed'));
    }
  };

  const getNanoConversion = (prompt: NanoBananaPrompt): NanoCreatorPromptSpecConversion => (
    nanoPromptToCreatorPromptSpec(prompt, i18nService.t('creatorBlankBuilder'))
  );

  const recordNanoCreatorAction = async ({
    prompt,
    importType,
    eventType,
    projectId,
    targetId,
    metadata = {},
  }: {
    prompt: NanoBananaPrompt;
    importType: NanoBananaPromptImportType;
    eventType: NanoBananaUsageEventType;
    projectId?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    await Promise.allSettled([
      nanoBananaService.recordImport({
        sourceId: prompt.sourceId,
        promptId: prompt.id,
        sourcePromptId: prompt.sourcePromptId,
        importType,
        projectId,
        targetId,
        metadata,
      }),
      nanoBananaService.recordUsage({
        sourceId: prompt.sourceId,
        promptId: prompt.id,
        sourcePromptId: prompt.sourcePromptId,
        eventType,
        importType,
        projectId,
        targetId,
        metadata,
      }),
    ]);
  };

  const useNanoPromptInBuilder = async (prompt: NanoBananaPrompt) => {
    const conversion = getNanoConversion(prompt);
    setBuilderSeed(conversion.seed);
    setBuilderForm(conversion.form);
    setActiveTab(CreatorStudioTab.Builder);
    dispatchToast(i18nService.t('nanoLibraryUsedInBuilder'));
    await recordNanoCreatorAction({
      prompt,
      importType: NanoBananaPromptImportType.Builder,
      eventType: NanoBananaUsageEventType.UseInBuilder,
      projectId: currentProjectId || workspace?.currentProjectId || null,
      targetId: conversion.promptSpec.sourceId,
      metadata: getNanoPromptMetadata(prompt),
    });
  };

  const saveNanoPromptAsRecipe = async (prompt: NanoBananaPrompt) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    const conversion = getNanoConversion(prompt);
    try {
      const recipe = await creatorStudioAssetService.createRecipe({
        projectId,
        title: prompt.title,
        description: prompt.description || null,
        promptSpec: toCreatorPromptSpecSnapshot(conversion.promptSpec),
        defaultRuntime: {
          activeSkillIds: installedRecommendedSkillIds,
          requestImageGeneration: false,
        },
        defaultOutput: {
          aspectRatio: conversion.promptSpec.constraints.aspectRatio ?? '',
          outputCount: conversion.promptSpec.outputCount,
        },
        tags: ['nano', ...prompt.promptCategories, ...prompt.tags, ...prompt.tagsZh],
      });
      await loadRecipes(projectId);
      dispatchToast(i18nService.t('creatorRecipeSaved'));
      await recordNanoCreatorAction({
        prompt,
        importType: NanoBananaPromptImportType.Recipe,
        eventType: NanoBananaUsageEventType.SaveAsRecipe,
        projectId,
        targetId: recipe.id,
        metadata: getNanoPromptMetadata(prompt),
      });
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorRecipeSaveFailed'));
    }
  };

  const saveNanoPromptAsPromptAsset = async (prompt: NanoBananaPrompt) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    const conversion = getNanoConversion(prompt);
    try {
      const asset = await creatorStudioAssetService.createPromptAsset({
        projectId,
        title: prompt.title,
        promptText: renderCreatorPrompt(conversion.promptSpec),
        promptSpec: toCreatorPromptSpecSnapshot(conversion.promptSpec),
        source: CreatorProductionAssetSource.NanoPrompt,
        licenseNote: conversion.licenseNote,
        usageNote: conversion.usageNote,
        tags: ['nano', ...prompt.promptCategories, ...prompt.tags, ...prompt.tagsZh],
        metadata: getNanoPromptMetadata(prompt),
      });
      dispatchToast(i18nService.t('creatorPromptAssetSaved'));
      await loadProjectAssets(projectId);
      await recordNanoCreatorAction({
        prompt,
        importType: NanoBananaPromptImportType.PromptAsset,
        eventType: NanoBananaUsageEventType.SaveAsPromptAsset,
        projectId,
        targetId: asset?.id ?? null,
        metadata: getNanoPromptMetadata(prompt),
      });
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorPromptAssetSaveFailed'));
    }
  };

  const addNanoPromptToBoard = async (prompt: NanoBananaPrompt) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    const activeBoardWorkspace = boardWorkspace?.projectId === projectId
      ? boardWorkspace
      : await loadBoardWorkspace(projectId);
    if (!activeBoardWorkspace.currentBoardId) {
      dispatchToast(i18nService.t('creatorBoardLoadFailed'));
      return;
    }
    const conversion = getNanoConversion(prompt);
    try {
      const card = await creatorStudioAssetService.addBoardCard({
        boardId: activeBoardWorkspace.currentBoardId,
        kind: CreatorBoardCardKind.Prompt,
        title: prompt.title,
        promptText: renderCreatorPrompt(conversion.promptSpec),
        promptSpec: toCreatorPromptSpecSnapshot(conversion.promptSpec),
        groupName: i18nService.t('creatorNanoLibraryTab'),
        notes: prompt.description,
        metadata: getNanoPromptMetadata(prompt),
      });
      await loadBoardWorkspace(projectId);
      dispatchToast(i18nService.t('nanoLibraryAddedToBoard'));
      await recordNanoCreatorAction({
        prompt,
        importType: NanoBananaPromptImportType.BoardCard,
        eventType: NanoBananaUsageEventType.AddToBoard,
        projectId,
        targetId: card?.id ?? null,
        metadata: getNanoPromptMetadata(prompt),
      });
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorBoardAddFailed'));
    }
  };

  const sendNanoPromptToCowork = async (prompt: NanoBananaPrompt) => {
    const conversion = getNanoConversion(prompt);
    const promptText = renderCreatorPrompt(conversion.promptSpec);
    const sent = await sendToCowork(conversion.promptSpec, promptText, [], false);
    if (!sent) return;
    dispatchToast(i18nService.t('nanoLibrarySentToCowork'));
    await recordNanoCreatorAction({
      prompt,
      importType: NanoBananaPromptImportType.Cowork,
      eventType: NanoBananaUsageEventType.SendToCowork,
      projectId: currentProjectId || workspace?.currentProjectId || null,
      targetId: prompt.id,
      metadata: getNanoPromptMetadata(prompt),
    });
  };

  const createNanoPromptBatchRun = async (prompt: NanoBananaPrompt) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    const conversion = getNanoConversion(prompt);
    let availableModelCapabilities = modelCapabilities;
    if (availableModelCapabilities.length === 0) {
      try {
        availableModelCapabilities = await loadModelCapabilities();
      } catch {
        dispatchToast(i18nService.t('creatorBatchModelLoadFailed'));
        return;
      }
    }
    const models = availableModelCapabilities.filter((model) => model.supportsBatch).slice(0, 2);
    if (models.length === 0) {
      dispatchToast(i18nService.t('creatorBatchModelLoadFailed'));
      return;
    }
    const templateIds = styleLibrary.templates.slice(0, 2).map((template) => template.id);
    const sizes = getNanoBatchSizes(conversion.promptSpec.constraints.aspectRatio);
    const directions = (conversion.promptSpec.creativeDirections ?? []).slice(0, 6).map((direction) => {
      const directionSpec = selectCreatorCreativeDirection(conversion.promptSpec, direction.id);
      return {
        ...direction,
        promptSpec: toCreatorPromptSpecSnapshot(directionSpec),
        promptText: renderCreatorPrompt(directionSpec),
      };
    });
    if (directions.length === 0) {
      dispatchToast(i18nService.t('creatorBatchCreateFailed'));
      return;
    }
    const batchRunInput: CreatorBatchRunCreateInput = {
      projectId,
      briefTitle: prompt.title,
      promptSpec: toCreatorPromptSpecSnapshot(conversion.promptSpec),
      promptText: renderCreatorPrompt(conversion.promptSpec),
      directions,
      modelIds: models.map((model) => model.id),
      templateIds: templateIds.length > 0 ? templateIds : ['default-template'],
      sizes,
    };
    setActiveTab(CreatorStudioTab.Batch);
    setBatchSubview(CreatorBatchSubview.Generation);
    const batchRun = await createBatchRun(batchRunInput);
    if (!batchRun) return;
    dispatchToast(i18nService.t('nanoLibraryBatchCreated'));
  };

  const savePromptAsset = async (promptSpec: CreatorPromptSpec, promptText: string) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    try {
      const title = (promptSpec.subject || promptSpec.sourceTitle || i18nService.t('creatorPromptAssetDefaultTitle')).trim();
      await creatorStudioAssetService.createPromptAsset({
        projectId,
        title,
        promptText,
        promptSpec: toCreatorPromptSpecSnapshot(promptSpec),
        templateId: promptSpec.templateId ?? null,
        caseIds: promptSpec.caseIds,
        tags: [
          promptSpec.category,
          ...(promptSpec.styles ?? []),
          ...(promptSpec.scenes ?? []),
        ].filter((item): item is string => Boolean(item?.trim())),
      });
      dispatchToast(i18nService.t('creatorPromptAssetSaved'));
      await loadProjectAssets(projectId);
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorPromptAssetSaveFailed'));
    }
  };

  const saveRecipe = async (promptSpec: CreatorPromptSpec) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    try {
      await creatorStudioAssetService.createRecipe({
        projectId,
        title: (promptSpec.subject || promptSpec.sourceTitle || i18nService.t('creatorRecipeDefaultTitle')).trim(),
        description: promptSpec.selectedCreativeDirection?.reason ?? null,
        promptSpec: toCreatorPromptSpecSnapshot(promptSpec),
        defaultRuntime: {
          activeSkillIds: installedRecommendedSkillIds,
          requestImageGeneration: false,
        },
        defaultOutput: {
          aspectRatio: promptSpec.constraints.aspectRatio ?? '',
          outputCount: promptSpec.outputCount,
        },
        tags: [
          promptSpec.category,
          promptSpec.templateId,
          promptSpec.selectedCreativeDirectionId,
          ...(promptSpec.styles ?? []),
          ...(promptSpec.scenes ?? []),
        ].filter((item): item is string => Boolean(item?.trim())),
      });
      await loadRecipes(projectId);
      dispatchToast(i18nService.t('creatorRecipeSaved'));
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorRecipeSaveFailed'));
    }
  };

  const importRecipe = async (recipeJson: string) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    try {
      const parsed = JSON.parse(recipeJson) as Partial<CreatorRecipeRecord>;
      if (!parsed.title || !parsed.promptSpec) {
        throw new Error(i18nService.t('creatorRecipeImportInvalid'));
      }
      await creatorStudioAssetService.importRecipe({
        projectId,
        recipe: {
          title: parsed.title,
          description: parsed.description ?? null,
          sourcePromptAssetId: parsed.sourcePromptAssetId ?? null,
          promptSpec: parsed.promptSpec,
          defaultRuntime: parsed.defaultRuntime ?? {},
          defaultOutput: parsed.defaultOutput ?? {},
          tags: parsed.tags ?? [],
        },
      });
      await loadRecipes(projectId);
      dispatchToast(i18nService.t('creatorRecipeImported'));
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorRecipeImportFailed'));
    }
  };

  const scheduleRecipeAutomation = async (recipe: CreatorRecipeRecord, cronExpression: string) => {
    const normalizedCronExpression = cronExpression.trim();
    if (!normalizedCronExpression) return;
    if (!window.electron?.scheduledTasks) {
      dispatchToast(i18nService.t('creatorRecipeAutomationFailed'));
      return;
    }
    try {
      await scheduledTaskService.createTask({
        name: i18nService.t('creatorRecipeAutomationTaskName').replace('{title}', recipe.title),
        description: i18nService.t('creatorRecipeAutomationTaskDescription').replace('{id}', recipe.id),
        enabled: true,
        schedule: {
          kind: ScheduleKind.Cron,
          expr: normalizedCronExpression,
        },
        sessionTarget: SessionTarget.Isolated,
        wakeMode: WakeMode.Now,
        payload: {
          kind: PayloadKind.AgentTurn,
          message: buildRecipeAutomationPrompt(recipe),
        },
        delivery: {
          mode: DeliveryMode.None,
        },
      });
      dispatchToast(i18nService.t('creatorRecipeAutomationCreated'));
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorRecipeAutomationFailed'));
    }
  };

  const exportProductionPackage = async () => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    try {
      const [assetResult, recipeResult, batchResult] = await Promise.all([
        creatorStudioAssetService.listAssets({ projectId, limit: 200 }),
        creatorStudioAssetService.listRecipes({ projectId, limit: 50 }),
        creatorStudioAssetService.listBatchRuns({ projectId, limit: 20 }),
      ]);
      setProjectAssets(assetResult.assets);
      setRecipes(recipeResult.recipes);
      setBatchRuns(batchResult.runs);
      setActiveBatchRun((current) => {
        if (!current) return batchResult.runs[0] ?? null;
        return batchResult.runs.find((run) => run.id === current.id) ?? batchResult.runs[0] ?? null;
      });
      const project = workspace?.projects.find((item) => item.id === projectId) ?? null;
      const manifest = buildCreatorProductionPackage({
        projectId,
        project,
        assets: assetResult.assets,
        recipes: recipeResult.recipes,
        batchRuns: batchResult.runs,
      });
      const dataBase64 = encodeTextBase64(JSON.stringify(manifest, null, 2));
      const result = await window.electron.dialog.saveInlineFile({
        dataBase64,
        fileName: buildProductionPackageFileName(manifest.project.name),
        mimeType: 'application/json',
      });
      if (!result.success) {
        throw new Error(result.error || i18nService.t('creatorProductionPackageExportFailed'));
      }
      dispatchToast(i18nService.t('creatorProductionPackageExported'));
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorProductionPackageExportFailed'));
    }
  };

  const saveCaseAsset = async (item: CreatorStudioCase) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    try {
      await creatorStudioAssetService.createCaseAsset({
        projectId,
        caseId: item.id,
        title: item.title,
        promptText: item.prompt,
        sourceLabel: item.sourceLabel,
        sourceUrl: item.sourceUrl,
        githubUrl: item.githubUrl,
        category: item.category,
        styles: item.styles,
        scenes: item.scenes,
        tags: item.tags,
      });
      dispatchToast(i18nService.t('creatorCaseAssetSaved'));
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorCaseAssetSaveFailed'));
    }
  };

  const startFromBrief = (brief: string, materials: CreatorBuilderMaterial[] = []) => {
    const result = applyCreatorBriefAutofill(defaultBuilderForm, brief);
    setBuilderSeed(null);
    setBuilderForm(result.form);
    setBuilderMaterials(materials);
    setBoardContextPack('');
    setActiveTab(CreatorStudioTab.Builder);
  };

  const startFromLocalImages = async (files: File[], brief: string) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0 && !brief.trim()) return;
    try {
      const materials = await Promise.all(imageFiles.map((file) => createMaterialFromFile(file, CreatorMaterialSource.File)));
      const filePaths = imageFiles.map(getFileSystemPath).filter((path): path is string => Boolean(path));
      if (filePaths.length > 0) {
        setImageToolsInitialFilePaths(filePaths);
        setActiveTab(CreatorStudioTab.ImageTools);
        if (brief.trim()) {
          const result = applyCreatorBriefAutofill(defaultBuilderForm, brief);
          setBuilderSeed(null);
          setBuilderForm(result.form);
          setBuilderMaterials(materials);
          setBoardContextPack('');
        }
        return;
      }
      startFromBrief(brief, materials);
    } catch {
      dispatchToast(i18nService.t('creatorStartMaterialImportFailed'));
    }
  };

  const openStartImageTools = () => {
    setActiveTab(CreatorStudioTab.ImageTools);
  };

  const createBatchRun = async (input: CreatorBatchRunCreateInput) => {
    setIsCreatingBatchRun(true);
    try {
      const batchRun = await creatorStudioAssetService.createBatchRun(input);
      setActiveBatchRun(batchRun);
      await loadBatchRuns(input.projectId);
      dispatchToast(i18nService.t('creatorBatchCreated'));
      const nano = input.promptSpec.provenance?.nano;
      if (nano) {
        const metadata = {
          taskMatrix: {
            directions: input.directions.length,
            models: input.modelIds.length,
            templates: input.templateIds.length,
            sizes: input.sizes.length,
          },
        };
        await Promise.allSettled([
          nanoBananaService.recordImport({
            sourceId: nano.sourceId,
            promptId: nano.promptId,
            sourcePromptId: nano.sourcePromptId,
            importType: NanoBananaPromptImportType.Batch,
            projectId: input.projectId,
            targetId: batchRun.id,
            metadata,
          }),
          nanoBananaService.recordUsage({
            sourceId: nano.sourceId,
            promptId: nano.promptId,
            sourcePromptId: nano.sourcePromptId,
            eventType: NanoBananaUsageEventType.CreateBatch,
            importType: NanoBananaPromptImportType.Batch,
            projectId: input.projectId,
            targetId: batchRun.id,
            metadata,
          }),
        ]);
      }
      return batchRun;
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorBatchCreateFailed'));
      return null;
    } finally {
      setIsCreatingBatchRun(false);
    }
  };

  const retryBatchTask = async (taskId: string) => {
    try {
      const batchRun = await creatorStudioAssetService.retryBatchTask(taskId);
      if (batchRun) {
        setActiveBatchRun(batchRun);
        await loadBatchRuns(batchRun.projectId);
      }
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorBatchRetryFailed'));
    }
  };

  const retryImageProcessingTask = async (taskId: string) => {
    if (!currentProjectId) return;
    try {
      await creatorStudioAssetService.retryImageTask({ taskId });
      await Promise.all([
        loadImageProcessingJobs(currentProjectId),
        loadProjectAssets(currentProjectId),
      ]);
      dispatchToast(i18nService.t('creatorImageBatchRetryDone'));
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorImageBatchRetryFailed'));
    }
  };

  const cancelImageProcessingTask = async (taskId: string) => {
    if (!currentProjectId) return;
    try {
      await creatorStudioAssetService.cancelImageTask({ taskId });
      await loadImageProcessingJobs(currentProjectId);
      dispatchToast(i18nService.t('creatorImageBatchCancelDone'));
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorImageBatchCancelFailed'));
    }
  };

  const openImageProcessingReport = async (jobId: string) => {
    try {
      await creatorStudioAssetService.openImageReport({ jobId });
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorImageProcessingReportOpenFailed'));
    }
  };

  const executeImageRecipe = async (
    asset: CreatorProductionAssetRecord,
    recipe: CreatorRecipeRecord,
  ) => {
    try {
      const result = await creatorStudioAssetService.executeImageRecipe({
        recipeId: recipe.id,
        assetId: asset.id,
      });
      await Promise.all([
        loadProjectAssets(asset.projectId),
        loadImageProcessingJobs(asset.projectId),
      ]);
      dispatchToast(
        result.outputAssetIds.length > 0
          ? i18nService.t('creatorImageRecipeExecuted')
          : i18nService.t('creatorImageProcessingCompleted')
      );
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorImageRecipeExecuteFailed'));
    }
  };

  const skipBatchTask = async (taskId: string) => {
    try {
      const batchRun = await creatorStudioAssetService.skipBatchTask(taskId);
      if (batchRun) {
        setActiveBatchRun(batchRun);
        await loadBatchRuns(batchRun.projectId);
      }
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorBatchSkipFailed'));
    }
  };

  const failBatchTask = async (taskId: string) => {
    const errorMessage = window.prompt(i18nService.t('creatorBatchFailReasonPrompt'));
    if (!errorMessage?.trim()) return;
    try {
      const batchRun = await creatorStudioAssetService.failBatchTask({ taskId, error: errorMessage.trim() });
      if (batchRun) {
        setActiveBatchRun(batchRun);
        await loadBatchRuns(batchRun.projectId);
      }
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorBatchFailFailed'));
    }
  };

  const saveBatchTaskAsRecipe = async (task: CreatorBatchTaskRecord) => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    try {
      const winningAsset = await resolveWinningBatchAsset(projectId, task.assetIds);
      await creatorStudioAssetService.createRecipe({
        projectId,
        title: task.directionTitle || i18nService.t('creatorRecipeDefaultTitle'),
        description: [
          `${task.modelName} · ${task.templateId} · ${task.size}`,
          winningAsset ? `winningAsset=${winningAsset.fileName}` : '',
        ].filter(Boolean).join(' · '),
        promptSpec: {
          ...task.promptSpec,
          selectedDirectionId: task.directionId,
          winningAssetId: winningAsset?.id ?? null,
          winningAssetFileName: winningAsset?.fileName ?? null,
          winningAssetAdoptionStatus: winningAsset?.adoptionStatus ?? null,
        },
        defaultRuntime: {
          modelId: task.modelId,
          modelName: task.modelName,
        },
        defaultOutput: {
          templateId: task.templateId,
          size: task.size,
          winningAssetId: winningAsset?.id ?? null,
        },
        tags: [
          task.directionId,
          task.modelId,
          task.templateId,
          task.size,
          winningAsset ? 'winning-direction' : 'batch-direction',
        ],
      });
      await loadRecipes(projectId);
      dispatchToast(i18nService.t('creatorRecipeSaved'));
    } catch (error) {
      dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorRecipeSaveFailed'));
    }
  };

  const sendBatchTaskToCowork = async (task: CreatorBatchTaskRecord) => {
    setIsSendingToCowork(true);
    try {
      dispatch(setActiveSkillIds(installedRecommendedSkillIds));
      await onSendToCowork([
        '[Creator Studio]',
        '',
        i18nService.t('creatorBatchCoworkDraftIntro'),
        '',
        `batchRunId: ${task.batchRunId}`,
        `batchTaskId: ${task.id}`,
        `directionId: ${task.directionId}`,
        `modelId: ${task.modelId}`,
        `modelName: ${task.modelName}`,
        `templateId: ${task.templateId}`,
        `size: ${task.size}`,
        '',
        'PromptSpec:',
        '```json',
        JSON.stringify(task.promptSpec, null, 2),
        '```',
        '',
        'Prompt:',
        '```text',
        task.promptText,
        '```',
      ].join('\n'), {
        activeSkillIds: installedRecommendedSkillIds,
        preferCreativeProducer: true,
        messageMetadata: buildCreatorCoworkMessageMetadata({
          promptSpec: task.promptSpec,
          promptText: task.promptText,
          activeSkillIds: installedRecommendedSkillIds,
          requestedAction: CreatorCoworkAction.BatchTask,
          source: {
            batchRunId: task.batchRunId,
            batchTaskId: task.id,
            directionId: task.directionId,
            modelId: task.modelId,
            templateId: task.templateId,
            size: task.size,
          },
        }),
      });
    } catch {
      dispatchToast(i18nService.t('creatorSendToCoworkFailed'));
    } finally {
      setIsSendingToCowork(false);
    }
  };

  const sendBatchRunToCowork = async (batchRun: CreatorBatchRunRecord) => {
    const pendingTasks = batchRun.tasks.filter((task) => task.status === CreatorBatchTaskStatus.Pending);
    if (pendingTasks.length === 0) {
      dispatchToast(i18nService.t('creatorBatchNoPendingTasks'));
      return;
    }
    setIsSendingToCowork(true);
    try {
      dispatch(setActiveSkillIds(installedRecommendedSkillIds));
      await onSendToCowork([
        '[Creator Studio]',
        '',
        i18nService.t('creatorBatchRunCoworkDraftIntro'),
        '',
        `batchRunId: ${batchRun.id}`,
        `briefTitle: ${batchRun.briefTitle}`,
        `taskCount: ${pendingTasks.length}`,
        `models: ${batchRun.summary.modelNames.join(', ')}`,
        `sizes: ${batchRun.summary.sizes.join(', ')}`,
        `costField: ${batchRun.summary.estimatedCostUnits} ${batchRun.summary.costUnitLabel}`,
        '',
        'Batch Tasks:',
        '```json',
        JSON.stringify(pendingTasks.map((task) => ({
          batchTaskId: task.id,
          directionId: task.directionId,
          directionTitle: task.directionTitle,
          modelId: task.modelId,
          modelName: task.modelName,
          templateId: task.templateId,
          size: task.size,
          promptSpec: task.promptSpec,
          prompt: task.promptText,
        })), null, 2),
        '```',
      ].join('\n'), {
        activeSkillIds: installedRecommendedSkillIds,
        preferCreativeProducer: true,
        messageMetadata: buildCreatorCoworkMessageMetadata({
          promptSpec: pendingTasks.map((task) => task.promptSpec),
          activeSkillIds: installedRecommendedSkillIds,
          requestedAction: CreatorCoworkAction.BatchRun,
          source: {
            batchRunId: batchRun.id,
            briefTitle: batchRun.briefTitle,
            taskIds: pendingTasks.map((task) => task.id),
            taskCount: pendingTasks.length,
          },
        }),
      });
    } catch {
      dispatchToast(i18nService.t('creatorSendToCoworkFailed'));
    } finally {
      setIsSendingToCowork(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label={i18nService.t('expand')}
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{i18nService.t('creatorStudioTitle')}</h1>
          <div className="mt-0.5 text-xs text-muted">
            {i18nService.t('creatorStudioDataSummary')}
          </div>
        </div>
        {updateBadge}
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <TabButton active={activeTab === CreatorStudioTab.Start} onClick={() => setActiveTab(CreatorStudioTab.Start)}>
          {i18nService.t('creatorStartTab')}
        </TabButton>
        <TabButton active={activeTab === CreatorStudioTab.Inspiration} onClick={() => openInspiration(inspirationSubview)}>
          {i18nService.t('creatorInspirationTab')}
        </TabButton>
        <TabButton active={activeTab === CreatorStudioTab.Builder} onClick={() => setActiveTab(CreatorStudioTab.Builder)}>
          {i18nService.t('creatorBuilderTab')}
        </TabButton>
        <TabButton active={activeTab === CreatorStudioTab.Assets} onClick={() => setActiveTab(CreatorStudioTab.Assets)}>
          {i18nService.t('creatorAssetsTab')}
        </TabButton>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === CreatorStudioTab.Start && (
          <CreatorStart
            recentAssets={projectAssets}
            featuredCases={cases.slice(0, 6)}
            featuredTemplates={styleLibrary.templates.slice(0, 4)}
            onStartBrief={startFromBrief}
            onStartImages={(files, brief) => void startFromLocalImages(files, brief)}
            onUseScenario={startFromBrief}
            onUseCase={startFromCase}
            onUseTemplate={startFromTemplate}
            onUseAsset={useAssetAsReference}
            onOpenGallery={() => openInspiration(CreatorInspirationSubview.Gallery)}
            onOpenNano={() => openInspiration(CreatorInspirationSubview.NanoLibrary)}
            onOpenAssets={() => setActiveTab(CreatorStudioTab.Assets)}
            onOpenImageTools={openStartImageTools}
          />
        )}
        {activeTab === CreatorStudioTab.Inspiration && (
          <CreatorInspiration
            activeSubview={inspirationSubview}
            onSubviewChange={setInspirationSubview}
            gallery={(
              <Gallery
                query={query}
                category={category}
                style={style}
                scene={scene}
                cases={visibleCases}
                totalCount={filteredCases.length}
                hasMore={visibleCaseCount < filteredCases.length}
                onQueryChange={setQuery}
                onCategoryChange={setCategory}
                onStyleChange={setStyle}
                onSceneChange={setScene}
                onClearFilters={() => {
                  setQuery('');
                  setCategory('');
                  setStyle('');
                  setScene('');
                }}
                onSelectCase={setSelectedCase}
                onUseCase={startFromCase}
                onLoadMore={() => setVisibleCaseCount((count) => count + CASE_PAGE_SIZE)}
              />
            )}
            templates={(
              <TemplateLibrary
                templates={styleLibrary.templates}
                templateCasesById={templateCasesById}
                onSelectTemplate={setSelectedTemplate}
                onUseTemplate={startFromTemplate}
              />
            )}
            nano={(
              <React.Suspense fallback={<CreatorLazyFallback />}>
                <NanoLibraryView
                  creatorActions={{
                    onUseInBuilder: useNanoPromptInBuilder,
                    onSaveAsRecipe: saveNanoPromptAsRecipe,
                    onSaveAsPromptAsset: saveNanoPromptAsPromptAsset,
                    onAddToBoard: addNanoPromptToBoard,
                    onSendToCowork: sendNanoPromptToCowork,
                    onCreateBatch: createNanoPromptBatchRun,
                  }}
                />
              </React.Suspense>
            )}
          />
        )}
        {activeTab === CreatorStudioTab.Builder && (
          <PromptBuilder
            seed={builderSeed}
            form={builderForm}
            onFormChange={setBuilderForm}
            materials={builderMaterials}
            onMaterialsChange={setBuilderMaterials}
            onOpenMaterialsInImageTools={(materials) => {
              const filePaths = materials.map((material) => material.path).filter(isImportableLocalPath);
              if (filePaths.length === 0) {
                dispatchToast(i18nService.t('creatorImageToolsNoLocalMaterialPaths'));
                return;
              }
              setImageToolsInitialFilePaths(filePaths);
              setActiveTab(CreatorStudioTab.ImageTools);
            }}
            onOpenBoard={() => setActiveTab(CreatorStudioTab.Board)}
            onOpenBatch={() => {
              setBatchSubview(CreatorBatchSubview.Generation);
              setActiveTab(CreatorStudioTab.Batch);
            }}
            onOpenImageTools={openStartImageTools}
            installedSkillIds={installedRecommendedSkillIds}
            missingSkillIds={missingRecommendedSkillIds}
            seedreamStatus={seedreamStatus}
            isSendingToCowork={isSendingToCowork}
            workspace={workspace}
            currentProjectId={currentProjectId}
            recipes={recipes}
            productionPackageSummary={productionPackageSummary}
            onProjectChange={(projectId) => void switchProject(projectId)}
            onCreateProject={createProject}
            onUseRecipe={useRecipeInBuilder}
            onSaveRecipe={(promptSpec) => void saveRecipe(promptSpec)}
            onImportRecipe={(recipeJson) => void importRecipe(recipeJson)}
            onScheduleRecipe={(recipe, cronExpression) => void scheduleRecipeAutomation(recipe, cronExpression)}
            onExportProductionPackage={() => void exportProductionPackage()}
            onClearSource={() => {
              setBuilderSeed(null);
              setBuilderForm(defaultBuilderForm);
              setBuilderMaterials([]);
              setBoardContextPack('');
            }}
            onOpenSourceDetail={() => openBuilderSourceDetail(builderSeed)}
            onSendToCowork={sendToCowork}
            onSavePromptAsset={(promptSpec, promptText) => void savePromptAsset(promptSpec, promptText)}
            brandKit={boardWorkspace?.brandKit ?? null}
            boardContextPack={boardContextPack}
          />
        )}
        {activeTab === CreatorStudioTab.Assets && (
          <React.Suspense fallback={<CreatorLazyFallback />}>
            <CreatorAssetGrid
              recipes={recipes}
              onOpenCoworkSession={onOpenCoworkSession}
              onUseAssetAsReference={useAssetAsReference}
              onSendAssetToCowork={sendAssetToCowork}
              onExecuteImageRecipe={(asset, recipe) => void executeImageRecipe(asset, recipe)}
            />
          </React.Suspense>
        )}
        {activeTab === CreatorStudioTab.ImageTools && (
          <React.Suspense fallback={<CreatorLazyFallback />}>
            <CreatorImageToolsPanel
              projectId={currentProjectId}
              assets={projectAssets}
              jobs={imageProcessingJobs}
              initialFilePaths={imageToolsInitialFilePaths}
              onInitialFilePathsConsumed={() => setImageToolsInitialFilePaths([])}
              onAssetsChanged={() => {
                if (currentProjectId) void loadProjectAssets(currentProjectId);
              }}
              onRefreshJobs={() => {
                if (currentProjectId) void loadImageProcessingJobs(currentProjectId);
              }}
              onRevealOutput={(input) => void creatorStudioAssetService.revealImageOutput(input).catch((error) => {
                dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorImageProcessingRevealFailed'));
              })}
              onOpenReport={(jobId) => void openImageProcessingReport(jobId)}
              onRetryTask={(taskId) => void retryImageProcessingTask(taskId)}
              onCancelTask={(taskId) => void cancelImageProcessingTask(taskId)}
            />
          </React.Suspense>
        )}
        {activeTab === CreatorStudioTab.Board && (
          <React.Suspense fallback={<CreatorLazyFallback />}>
            <CreatorBoard
              projectId={currentProjectId}
              workspace={boardWorkspace}
              currentPromptSpec={boardPromptSpec}
              currentPromptText={boardPromptText}
              directions={boardPromptSpec.creativeDirections ?? []}
              onWorkspaceChange={setBoardWorkspace}
              onUseContextPack={(contextPack) => {
                setBoardContextPack(contextPack);
                setActiveTab(CreatorStudioTab.Builder);
              }}
              onUseDirection={(direction) => {
                setBuilderForm((form) => ({
                  ...form,
                  visualStyle: [form.visualStyle, direction.style, direction.promptFocus]
                    .filter((item) => item.trim())
                    .join(', '),
                }));
                setActiveTab(CreatorStudioTab.Builder);
              }}
            />
          </React.Suspense>
        )}
        {activeTab === CreatorStudioTab.Batch && (
          <React.Suspense fallback={<CreatorLazyFallback />}>
            <div>
              <div className="border-b border-border px-4 py-3">
                <div className="inline-flex rounded-lg border border-border bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setBatchSubview(CreatorBatchSubview.Generation)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      batchSubview === CreatorBatchSubview.Generation
                        ? 'bg-primary text-white'
                        : 'text-secondary hover:bg-surface-raised hover:text-foreground'
                    }`}
                  >
                    {i18nService.t('creatorBatchGenerationSegment')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchSubview(CreatorBatchSubview.ImageProcessing)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      batchSubview === CreatorBatchSubview.ImageProcessing
                        ? 'bg-primary text-white'
                        : 'text-secondary hover:bg-surface-raised hover:text-foreground'
                    }`}
                  >
                    {i18nService.t('creatorBatchImageProcessingSegment')}
                  </button>
                </div>
              </div>
              {batchSubview === CreatorBatchSubview.Generation ? (
                <CreatorBatchPanel
                  projectId={currentProjectId}
                  promptSpec={batchPromptSpec}
                  promptText={batchPromptText}
                  templates={styleLibrary.templates}
                  modelCapabilities={modelCapabilities}
                  batchRuns={batchRuns}
                  activeBatchRun={activeBatchRun}
                  isCreating={isCreatingBatchRun}
                  onCreateBatchRun={(input) => void createBatchRun(input)}
                  onSelectBatchRun={setActiveBatchRun}
                  onRefresh={() => {
                    if (currentProjectId) void loadBatchRuns(currentProjectId);
                  }}
                  onRetryTask={(taskId) => void retryBatchTask(taskId)}
                  onSkipTask={(taskId) => void skipBatchTask(taskId)}
                  onFailTask={(taskId) => void failBatchTask(taskId)}
                  onSendTaskToCowork={(task) => void sendBatchTaskToCowork(task)}
                  onSendBatchToCowork={(batchRun) => void sendBatchRunToCowork(batchRun)}
                  onSaveTaskAsRecipe={(task) => void saveBatchTaskAsRecipe(task)}
                />
              ) : (
                <CreatorImageProcessingBatchPanel
                  jobs={imageProcessingJobs}
                  onRefresh={() => {
                    if (currentProjectId) void loadImageProcessingJobs(currentProjectId);
                  }}
                  onRevealOutput={(input) => void creatorStudioAssetService.revealImageOutput(input).catch((error) => {
                    dispatchToast(error instanceof Error ? error.message : i18nService.t('creatorImageProcessingRevealFailed'));
                  })}
                  onOpenReport={(jobId) => void openImageProcessingReport(jobId)}
                  onRetryTask={(taskId) => void retryImageProcessingTask(taskId)}
                  onCancelTask={(taskId) => void cancelImageProcessingTask(taskId)}
                />
              )}
            </div>
          </React.Suspense>
        )}
      </main>

      {selectedCase && (
        <CaseDrawer
          item={selectedCase}
          onClose={() => setSelectedCase(null)}
          onUseCase={startFromCase}
          onSaveCase={(item) => void saveCaseAsset(item)}
        />
      )}
      {selectedTemplate && (
        <TemplateDrawer
          template={selectedTemplate}
          templateCasesById={templateCasesById}
          onClose={() => setSelectedTemplate(null)}
          onUseTemplate={startFromTemplate}
          onOpenExampleCase={openExampleCase}
        />
      )}
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-primary text-white'
        : 'text-secondary hover:bg-surface-raised hover:text-foreground'
    }`}
  >
    {children}
  </button>
);

const CreatorInspiration: React.FC<{
  activeSubview: CreatorInspirationSubview;
  onSubviewChange: (subview: CreatorInspirationSubview) => void;
  gallery: React.ReactNode;
  templates: React.ReactNode;
  nano: React.ReactNode;
}> = ({ activeSubview, onSubviewChange, gallery, templates, nano }) => (
  <section className="min-h-full bg-background">
    <div className="border-b border-border bg-background px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{i18nService.t('creatorInspirationTitle')}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">{i18nService.t('creatorInspirationSubtitle')}</p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface p-1">
          <SegmentButton
            active={activeSubview === CreatorInspirationSubview.Gallery}
            onClick={() => onSubviewChange(CreatorInspirationSubview.Gallery)}
          >
            {i18nService.t('creatorGalleryTab')}
          </SegmentButton>
          <SegmentButton
            active={activeSubview === CreatorInspirationSubview.Templates}
            onClick={() => onSubviewChange(CreatorInspirationSubview.Templates)}
          >
            {i18nService.t('creatorTemplatesTab')}
          </SegmentButton>
          <SegmentButton
            active={activeSubview === CreatorInspirationSubview.NanoLibrary}
            onClick={() => onSubviewChange(CreatorInspirationSubview.NanoLibrary)}
          >
            {i18nService.t('creatorNanoLibraryTab')}
          </SegmentButton>
        </div>
      </div>
    </div>
    {activeSubview === CreatorInspirationSubview.Gallery && gallery}
    {activeSubview === CreatorInspirationSubview.Templates && templates}
    {activeSubview === CreatorInspirationSubview.NanoLibrary && nano}
  </section>
);

const SegmentButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-raised hover:text-foreground'
    }`}
  >
    {children}
  </button>
);

const CreatorStart: React.FC<{
  recentAssets: CreatorProductionAssetRecord[];
  featuredCases: CreatorStudioCase[];
  featuredTemplates: CreatorStudioTemplate[];
  onStartBrief: (brief: string) => void;
  onStartImages: (files: File[], brief: string) => void;
  onUseScenario: (brief: string) => void;
  onUseCase: (item: CreatorStudioCase) => void;
  onUseTemplate: (template: CreatorStudioTemplate) => void;
  onUseAsset: (asset: CreatorProductionAssetRecord) => void;
  onOpenGallery: () => void;
  onOpenNano: () => void;
  onOpenAssets: () => void;
  onOpenImageTools: () => void;
}> = ({
  recentAssets,
  featuredCases,
  featuredTemplates,
  onStartBrief,
  onStartImages,
  onUseScenario,
  onUseCase,
  onUseTemplate,
  onUseAsset,
  onOpenGallery,
  onOpenNano,
  onOpenAssets,
  onOpenImageTools,
}) => {
  const [brief, setBrief] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const recent = useMemo(
    () => [...recentAssets].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 6),
    [recentAssets]
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    onStartImages(files, brief);
  };

  return (
    <section className="grid gap-4 p-4 xl:grid-cols-[minmax(360px,520px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{i18nService.t('creatorStartTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary">{i18nService.t('creatorStartSubtitle')}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <StartTaskCard
              icon={<RocketLaunchIcon className="h-4 w-4" />}
              title={i18nService.t('creatorStartGenerateImageTitle')}
              description={i18nService.t('creatorStartGenerateImageHint')}
              onClick={() => {
                if (brief.trim()) {
                  onStartBrief(brief);
                  return;
                }
                const scenarioBrief = i18nService.t('creatorStartScenarioSocialCoverBrief');
                setBrief(scenarioBrief);
                onUseScenario(scenarioBrief);
              }}
              action={CreatorStartAction.GenerateImage}
            />
            <StartTaskCard
              icon={<WrenchScrewdriverIcon className="h-4 w-4" />}
              title={i18nService.t('creatorStartProcessImagesTitle')}
              description={i18nService.t('creatorStartProcessImagesHint')}
              onClick={onOpenImageTools}
              action={CreatorStartAction.ProcessImages}
            />
            <StartTaskCard
              icon={<MagnifyingGlassIcon className="h-4 w-4" />}
              title={i18nService.t('creatorStartFindInspirationTitle')}
              description={i18nService.t('creatorStartFindInspirationHint')}
              onClick={onOpenGallery}
              action={CreatorStartAction.FindInspiration}
            />
          </div>
          <label className="mt-4 block">
            <span className="text-xs font-medium text-secondary">{i18nService.t('creatorStartBriefLabel')}</span>
            <textarea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={5}
              placeholder={i18nService.t('creatorStartBriefPlaceholder')}
              className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {CREATOR_START_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => {
                  const scenarioBrief = i18nService.t(scenario.briefKey);
                  setBrief(scenarioBrief);
                  onUseScenario(scenarioBrief);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                {i18nService.t(scenario.labelKey)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!brief.trim()}
              onClick={() => onStartBrief(brief)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              {i18nService.t('creatorStartCreateDraft')}
            </button>
            <button
              type="button"
              onClick={onOpenGallery}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {i18nService.t('creatorStartBrowseCases')}
            </button>
          </div>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-lg border border-dashed p-4 transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-muted">
              <PhotoIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">{i18nService.t('creatorStartDropTitle')}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{i18nService.t('creatorStartDropHint')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{i18nService.t('creatorStartImageToolsTitle')}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{i18nService.t('creatorStartImageToolsHint')}</p>
            </div>
            <button
              type="button"
              onClick={onOpenImageTools}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              data-creator-start-action={CreatorStartAction.ProcessImages}
            >
              <WrenchScrewdriverIcon className="h-4 w-4" />
              {i18nService.t('creatorStartOpenImageTools')}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <StartSection
          title={i18nService.t('creatorStartRecentAssets')}
          actionLabel={i18nService.t('creatorStartOpenAssets')}
          onAction={onOpenAssets}
        >
          {recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted">
              {i18nService.t('creatorStartNoRecentAssets')}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recent.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onUseAsset(asset)}
                  className="min-w-0 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-surface-raised"
                >
                  <div className="flex items-center gap-2">
                    <PhotoIcon className="h-4 w-4 shrink-0 text-muted" />
                    <span className="truncate text-sm font-medium">{asset.fileName}</span>
                  </div>
                  <div className="mt-2 truncate text-xs text-muted">
                    {asset.promptSpec?.sourceTitle ?? (asset.promptText.slice(0, 80) || i18nService.t('creatorStartAssetNoPrompt'))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </StartSection>

        <StartSection
          title={i18nService.t('creatorStartRecommendedInspiration')}
          actionLabel={i18nService.t('creatorStartOpenInspiration')}
          onAction={onOpenNano}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {featuredCases.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onUseCase(item)}
                className="overflow-hidden rounded-lg border border-border bg-background text-left transition-colors hover:bg-surface-raised"
              >
                <PlaceholderImage src={item.image} alt={item.imageAlt} className="h-28 w-full" />
                <div className="p-3">
                  <div className="line-clamp-2 text-sm font-medium">{item.title}</div>
                  <div className="mt-2 text-xs text-muted">{i18nService.t('creatorStartCaseSource')}</div>
                </div>
              </button>
            ))}
            {featuredTemplates.slice(0, 3).map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onUseTemplate(template)}
                className="overflow-hidden rounded-lg border border-border bg-background text-left transition-colors hover:bg-surface-raised"
              >
                <PlaceholderImage src={template.cover} alt={getText(template.title)} className="h-28 w-full" />
                <div className="p-3">
                  <div className="line-clamp-2 text-sm font-medium">{getText(template.title)}</div>
                  <div className="mt-2 text-xs text-muted">{i18nService.t('creatorStartTemplateSource')}</div>
                </div>
              </button>
            ))}
          </div>
        </StartSection>

        <StartSection title={i18nService.t('creatorStartAdvancedEntrypoints')}>
          <div className="flex flex-wrap gap-2">
            <StartShortcut label={i18nService.t('creatorInspirationTab')} onClick={onOpenGallery} />
            <StartShortcut label={i18nService.t('creatorAssetsTab')} onClick={onOpenAssets} />
            <StartShortcut label={i18nService.t('creatorImageToolsTab')} onClick={onOpenImageTools} />
          </div>
        </StartSection>
      </div>
    </section>
  );
};

const StartTaskCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  action: CreatorStartAction;
}> = ({ icon, title, description, onClick, action }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-w-0 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-surface-raised"
    data-creator-start-action={action}
  >
    <div className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 truncate">{title}</span>
    </div>
    <p className="mt-2 text-xs leading-5 text-muted">{description}</p>
  </button>
);

const StartSection: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ title, actionLabel, onAction, children }) => (
  <section className="rounded-lg border border-border bg-surface p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-medium text-primary hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
    {children}
  </section>
);

const StartShortcut: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
  >
    {label}
  </button>
);

const CreatorImageToolsPanel: React.FC<{
  projectId: string;
  assets: CreatorProductionAssetRecord[];
  jobs: CreatorImageJobListResult['jobs'];
  initialFilePaths: string[];
  onInitialFilePathsConsumed: () => void;
  onAssetsChanged: () => void;
  onRefreshJobs: () => void;
  onRevealOutput: (input: CreatorImageOutputRevealInput) => void;
  onOpenReport: (jobId: string) => void;
  onRetryTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
}> = ({
  projectId,
  assets,
  jobs,
  initialFilePaths,
  onInitialFilePathsConsumed,
  onAssetsChanged,
  onRefreshJobs,
  onRevealOutput,
  onOpenReport,
  onRetryTask,
  onCancelTask,
}) => {
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(() => new Set());
  const [quickEditAsset, setQuickEditAsset] = useState<CreatorProductionAssetRecord | null>(null);
  const [status, setStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [maxWidth, setMaxWidth] = useState('1600');
  const [maxHeight, setMaxHeight] = useState('1600');
  const [quality, setQuality] = useState('82');
  const handledImportKeyRef = useRef('');
  const importCallbacksRef = useRef({
    onAssetsChanged,
    onInitialFilePathsConsumed,
    onRefreshJobs,
  });

  useEffect(() => {
    importCallbacksRef.current = {
      onAssetsChanged,
      onInitialFilePathsConsumed,
      onRefreshJobs,
    };
  }, [onAssetsChanged, onInitialFilePathsConsumed, onRefreshJobs]);

  const processableAssets = useMemo(() => (
    assets
      .filter((asset) => (
        asset.kind === CreatorProductionAssetKind.Image
        && asset.status === CreatorProductionAssetStatus.Ready
      ))
      .slice(0, 120)
  ), [assets]);

  useEffect(() => {
    if (!projectId || initialFilePaths.length === 0) {
      handledImportKeyRef.current = '';
      return undefined;
    }
    const importableFilePaths = initialFilePaths.filter(isImportableLocalPath);
    const importKey = `${projectId}:${importableFilePaths.join('\n')}`;
    if (handledImportKeyRef.current === importKey) return undefined;
    handledImportKeyRef.current = importKey;
    if (importableFilePaths.length === 0) {
      setStatus(i18nService.t('creatorImageToolsNoLocalMaterialPaths'));
      importCallbacksRef.current.onInitialFilePathsConsumed();
      return undefined;
    }
    let cancelled = false;
    setIsImporting(true);
    setStatus(i18nService.t('creatorImageToolsImporting'));
    void creatorStudioAssetService.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Reference,
      filePaths: importableFilePaths,
    })
      .then((result) => {
        if (cancelled) return;
        const importedImageIds = result.assets
          .filter((asset) => asset.kind === CreatorProductionAssetKind.Image)
          .map((asset) => asset.id);
        setSelectedAssetIds(new Set(importedImageIds));
        setStatus(getImageToolsImportSummary(result.imported, result.reused, result.skipped, result.failures.length));
        importCallbacksRef.current.onAssetsChanged();
        importCallbacksRef.current.onRefreshJobs();
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : i18nService.t('creatorLocalImageImportFailed'));
      })
      .finally(() => {
        if (cancelled) return;
        setIsImporting(false);
        importCallbacksRef.current.onInitialFilePathsConsumed();
      });
    return () => {
      cancelled = true;
    };
  }, [initialFilePaths, projectId]);

  const selectedAssets = useMemo(
    () => processableAssets.filter((asset) => selectedAssetIds.has(asset.id)),
    [processableAssets, selectedAssetIds]
  );
  const selectedPrimaryAsset = selectedAssets[0] ?? null;

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((ids) => {
      const next = new Set(ids);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const selectRecent = () => {
    setSelectedAssetIds(new Set(processableAssets.slice(0, 12).map((asset) => asset.id)));
  };

  const createBatch = async (mode: CreatorImageToolBatchMode) => {
    if (!projectId || selectedAssets.length === 0) return;
    const parsedQuality = Number(quality);
    const parsedMaxWidth = Number(maxWidth);
    const parsedMaxHeight = Number(maxHeight);
    setIsCreatingBatch(true);
    setStatus('');
    try {
      await creatorStudioAssetService.createImageBatch({
        projectId,
        assetIds: selectedAssets.map((asset) => asset.id),
        waitForCompletion: false,
        outputFormat: CreatorImageProcessingOutputFormat.Webp,
        quality: mode === CreatorImageToolBatchMode.Compress
          ? 72
          : Number.isFinite(parsedQuality) && parsedQuality > 0 ? parsedQuality : 82,
        ...(mode === CreatorImageToolBatchMode.Resize && Number.isFinite(parsedMaxWidth) && parsedMaxWidth > 0 ? { maxWidth: parsedMaxWidth } : {}),
        ...(mode === CreatorImageToolBatchMode.Resize && Number.isFinite(parsedMaxHeight) && parsedMaxHeight > 0 ? { maxHeight: parsedMaxHeight } : {}),
      });
      setStatus(i18nService.t('creatorImageBatchCreated'));
      setSelectedAssetIds(new Set());
      onAssetsChanged();
      onRefreshJobs();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : i18nService.t('creatorImageBatchCreateFailed'));
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const revealAsset = async (asset: CreatorProductionAssetRecord) => {
    try {
      await creatorStudioAssetService.revealAssetInFolder(asset.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : i18nService.t('creatorAssetFileUnavailable'));
    }
  };

  const openSourceAsset = async (asset: CreatorProductionAssetRecord) => {
    if (!asset.imageProcessing?.sourceAssetId) {
      setStatus(i18nService.t('creatorImageToolsSourceUnavailable'));
      return;
    }
    const sourceAsset = assets.find((item) => item.id === asset.imageProcessing?.sourceAssetId);
    if (!sourceAsset) {
      setStatus(i18nService.t('creatorImageToolsSourceUnavailable'));
      return;
    }
    setSelectedAssetIds(new Set([sourceAsset.id]));
    setStatus(i18nService.t('creatorImageToolsSourceSelected'));
  };

  const inspectSelectedImages = () => {
    if (!selectedPrimaryAsset) {
      setStatus(i18nService.t('creatorImageToolsTaskSelectFirst'));
      return;
    }
    setStatus(formatCreatorImageToolMetadataSummary(selectedPrimaryAsset));
  };

  const openCoverResizeTask = () => {
    if (!selectedPrimaryAsset) {
      setStatus(i18nService.t('creatorImageToolsTaskSelectFirst'));
      return;
    }
    if (selectedAssets.length === 1) {
      setQuickEditAsset(selectedPrimaryAsset);
      return;
    }
    void createBatch(CreatorImageToolBatchMode.Resize);
  };

  return (
    <section className="grid gap-4 p-4 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <WrenchScrewdriverIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{i18nService.t('creatorImageToolsTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary">{i18nService.t('creatorImageToolsSubtitle')}</p>
            </div>
          </div>
          {status && (
            <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-xs leading-5 text-secondary">
              {status}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{i18nService.t('creatorImageToolsTaskPanelTitle')}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{i18nService.t('creatorImageToolsTaskPanelHint')}</p>
            </div>
            <span className="rounded-md bg-surface-raised px-2 py-1 text-xs text-muted">
              {selectedAssets.length}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isImporting}
              onClick={selectRecent}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {i18nService.t('creatorImageToolsSelectRecent')}
            </button>
            <button
              type="button"
              disabled={isImporting}
              onClick={() => setSelectedAssetIds(new Set())}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {i18nService.t('creatorImageToolsClearSelection')}
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            <ImageToolTaskCard
              task={CreatorImageToolTask.QuickEdit}
              title={i18nService.t('creatorImageToolsTaskQuickEditTitle')}
              description={i18nService.t('creatorImageToolsTaskQuickEditHint')}
              disabled={!selectedPrimaryAsset || isCreatingBatch || isImporting}
              disabledHint={i18nService.t('creatorImageToolsTaskSelectFirst')}
              onClick={() => {
                if (selectedPrimaryAsset) setQuickEditAsset(selectedPrimaryAsset);
              }}
            >
              <SparklesIcon className="h-4 w-4" />
            </ImageToolTaskCard>
            <ImageToolTaskCard
              task={CreatorImageToolTask.Compress}
              title={i18nService.t('creatorImageToolsTaskCompressTitle')}
              description={i18nService.t('creatorImageToolsTaskCompressHint')}
              disabled={selectedAssets.length === 0 || isCreatingBatch || isImporting}
              disabledHint={i18nService.t('creatorImageToolsTaskSelectImages')}
              onClick={() => void createBatch(CreatorImageToolBatchMode.Compress)}
            >
              <ArrowDownIcon className="h-4 w-4" />
            </ImageToolTaskCard>
            <ImageToolTaskCard
              task={CreatorImageToolTask.Webp}
              title={i18nService.t('creatorImageToolsTaskWebpTitle')}
              description={i18nService.t('creatorImageToolsTaskWebpHint')}
              disabled={selectedAssets.length === 0 || isCreatingBatch || isImporting}
              onClick={() => void createBatch(CreatorImageToolBatchMode.Webp)}
              disabledHint={i18nService.t('creatorImageToolsTaskSelectImages')}
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </ImageToolTaskCard>
            <ImageToolTaskCard
              task={CreatorImageToolTask.CoverResize}
              title={i18nService.t('creatorImageToolsTaskCoverResizeTitle')}
              description={i18nService.t('creatorImageToolsTaskCoverResizeHint')}
              disabled={selectedAssets.length === 0 || isCreatingBatch || isImporting}
              disabledHint={i18nService.t('creatorImageToolsTaskSelectImages')}
              onClick={openCoverResizeTask}
            >
              <PhotoIcon className="h-4 w-4" />
            </ImageToolTaskCard>
            <ImageToolTaskCard
              task={CreatorImageToolTask.Inspect}
              title={i18nService.t('creatorImageToolsTaskInspectTitle')}
              description={i18nService.t('creatorImageToolsTaskInspectHint')}
              disabled={selectedAssets.length === 0 || isCreatingBatch || isImporting}
              disabledHint={i18nService.t('creatorImageToolsTaskSelectImages')}
              onClick={inspectSelectedImages}
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
            </ImageToolTaskCard>
          </div>
          <details className="mt-3 rounded-lg border border-border bg-background p-3">
            <summary className="cursor-pointer text-xs font-medium text-secondary">
              {i18nService.t('creatorImageToolsAdvancedSettings')}
            </summary>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageProcessingQuality')}</span>
                <input value={quality} onChange={(event) => setQuality(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageBatchMaxWidth')}</span>
                <input value={maxWidth} onChange={(event) => setMaxWidth(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
              </label>
              <label className="space-y-1 text-xs text-secondary">
                <span>{i18nService.t('creatorImageBatchMaxHeight')}</span>
                <input value={maxHeight} onChange={(event) => setMaxHeight(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
              </label>
            </div>
          </details>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">{i18nService.t('creatorImageToolsAssetPicker')}</h3>
            <button
              type="button"
              onClick={onAssetsChanged}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {i18nService.t('creatorAssetsRefresh')}
            </button>
          </div>
          {processableAssets.length === 0 ? (
            <div className="flex min-h-44 items-center justify-center p-4 text-center text-sm text-muted">
              {i18nService.t('creatorImageToolsNoProcessableAssets')}
            </div>
          ) : (
            <div className="grid gap-2 p-3 md:grid-cols-2 2xl:grid-cols-3">
              {processableAssets.map((asset) => (
                <div key={asset.id} className="rounded-lg border border-border bg-background p-3">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAssetIds.has(asset.id)}
                      onChange={() => toggleAsset(asset.id)}
                      className="mt-1 h-4 w-4 rounded border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{asset.fileName}</div>
                      <div className="mt-1 truncate text-xs text-muted">{asset.filePath}</div>
                    </div>
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickEditAsset(asset)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                    >
                      {i18nService.t('creatorImageToolsTaskQuickEditTitle')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void revealAsset(asset)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                    >
                      {i18nService.t('creatorAssetReveal')}
                    </button>
                    {asset.imageProcessing?.sourceAssetId && (
                      <button
                        type="button"
                        onClick={() => void openSourceAsset(asset)}
                        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                      >
                        {i18nService.t('creatorImageToolsTraceSource')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <CreatorImageProcessingBatchPanel
          jobs={jobs}
          onRefresh={onRefreshJobs}
          onRevealOutput={onRevealOutput}
          onOpenReport={onOpenReport}
          onRetryTask={onRetryTask}
          onCancelTask={onCancelTask}
        />
      </div>
      <ImageQuickEditDrawer
        asset={quickEditAsset}
        onClose={() => setQuickEditAsset(null)}
        onCompleted={() => {
          setQuickEditAsset(null);
          onAssetsChanged();
          onRefreshJobs();
        }}
      />
    </section>
  );
};

const getImageToolsImportSummary = (
  imported: number,
  reused: number,
  skipped: number,
  failures: number
): string => (
  i18nService.t('creatorImageToolsImportSummary')
    .replace('{imported}', String(imported))
    .replace('{reused}', String(reused))
    .replace('{skipped}', String(skipped))
    .replace('{failures}', String(failures))
);

const formatCreatorImageToolFileSize = (bytes: number | null | undefined): string => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return i18nService.t('creatorImageUnknown');
  }
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const getCreatorImageToolMetadataStatusLabel = (
  asset: CreatorProductionAssetRecord
): string => {
  switch (asset.imageMetadata?.status) {
    case CreatorImageMetadataStatus.Ready:
      return i18nService.t('creatorImageMetadataReady');
    case CreatorImageMetadataStatus.Missing:
      return i18nService.t('creatorImageMetadataMissing');
    case CreatorImageMetadataStatus.Corrupt:
      return i18nService.t('creatorImageMetadataCorrupt');
    case CreatorImageMetadataStatus.Unsupported:
      return i18nService.t('creatorImageMetadataUnsupported');
    default:
      return i18nService.t('creatorImageMetadataNotLoaded');
  }
};

const formatCreatorImageToolMetadataSummary = (
  asset: CreatorProductionAssetRecord
): string => {
  const dimensions = asset.imageMetadata?.width && asset.imageMetadata.height
    ? `${asset.imageMetadata.width} x ${asset.imageMetadata.height}`
    : i18nService.t('creatorImageUnknown');
  const format = asset.imageMetadata?.format?.toUpperCase()
    || asset.mimeType
    || i18nService.t('creatorImageUnknown');
  return i18nService.t('creatorImageToolsInspectStatus')
    .replace('{file}', asset.fileName)
    .replace('{dimensions}', dimensions)
    .replace('{format}', format)
    .replace('{size}', formatCreatorImageToolFileSize(asset.imageMetadata?.fileSize))
    .replace('{status}', getCreatorImageToolMetadataStatusLabel(asset));
};

const ImageToolTaskCard: React.FC<{
  task: CreatorImageToolTask;
  title: string;
  description: string;
  disabled: boolean;
  disabledHint: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ task, title, description, disabled, disabledHint, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    title={disabled ? disabledHint : title}
    className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-55"
    data-creator-image-tool-task={task}
  >
    <div className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {children}
      </span>
      <span className="min-w-0 truncate">{title}</span>
    </div>
    <p className="mt-2 text-xs leading-5 text-muted">{disabled ? disabledHint : description}</p>
  </button>
);

const Gallery: React.FC<{
  query: string;
  category: string;
  style: string;
  scene: string;
  cases: CreatorStudioCase[];
  totalCount: number;
  hasMore: boolean;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  onSceneChange: (value: string) => void;
  onClearFilters: () => void;
  onSelectCase: (item: CreatorStudioCase) => void;
  onUseCase: (item: CreatorStudioCase) => void;
  onLoadMore: () => void;
}> = ({
  query,
  category,
  style,
  scene,
  cases: filteredCases,
  totalCount,
  hasMore,
  onQueryChange,
  onCategoryChange,
  onStyleChange,
  onSceneChange,
  onClearFilters,
  onSelectCase,
  onUseCase,
  onLoadMore,
}) => {
  const [thumbnailSize, setThumbnailSize] = useState(GALLERY_THUMBNAIL_SIZE_DEFAULT);
  return (
    <section className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full sm:w-80">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={i18nService.t('creatorSearchPlaceholder')}
            className="h-10 w-full rounded-lg border border-border bg-surface px-9 text-sm outline-none focus:border-primary"
          />
        </label>
        <FilterSelect className="w-full sm:w-44" value={category} onChange={onCategoryChange} label={i18nService.t('creatorFilterCategory')}>
          {styleLibrary.categories.map((item) => (
            <option key={item.id} value={item.value}>{getText(item.title)}</option>
          ))}
        </FilterSelect>
        <FilterSelect className="w-full sm:w-40" value={style} onChange={onStyleChange} label={i18nService.t('creatorFilterStyle')}>
          {styleLibrary.styles.map((item) => (
            <option key={item.id} value={item.value}>{getText(item.title)}</option>
          ))}
        </FilterSelect>
        <FilterSelect className="w-full sm:w-40" value={scene} onChange={onSceneChange} label={i18nService.t('creatorFilterScene')}>
          {styleLibrary.scenes.map((item) => (
            <option key={item.id} value={item.value}>{getText(item.title)}</option>
          ))}
        </FilterSelect>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-secondary">
          <span>{i18nService.t('creatorThumbnailSize')}</span>
          <input
            type="range"
            min={GALLERY_THUMBNAIL_SIZE_MIN}
            max={GALLERY_THUMBNAIL_SIZE_MAX}
            step={GALLERY_THUMBNAIL_SIZE_STEP}
            value={thumbnailSize}
            onChange={(event) => setThumbnailSize(Number(event.target.value))}
            aria-label={i18nService.t('creatorThumbnailSize')}
            className="w-28 accent-primary"
          />
          <span className="w-12 text-right tabular-nums">{thumbnailSize}px</span>
        </label>
        <button
          type="button"
          onClick={onClearFilters}
          className="h-10 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          {i18nService.t('creatorClearFilters')}
        </button>
      </div>
      <div className="text-xs text-muted">
        {i18nService.t('creatorResultCount').replace('{count}', String(totalCount))}
      </div>
      {totalCount === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface text-center">
          <PhotoIcon className="h-10 w-10 text-muted" />
          <div className="mt-3 text-sm font-medium">{i18nService.t('creatorEmptyTitle')}</div>
          <div className="mt-1 text-xs text-muted">{i18nService.t('creatorEmptyHint')}</div>
        </div>
      ) : (
        <>
          <div
            style={{
              columnWidth: `${thumbnailSize}px`,
              columnGap: '0.75rem',
            }}
          >
            {filteredCases.map((item) => (
              <CaseCard
                key={item.id}
                item={item}
                onSelect={onSelectCase}
                onUseCase={onUseCase}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onLoadMore}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                {i18nService.t('creatorLoadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const FilterSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, onChange, label, children, className = '' }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    aria-label={label}
    className={`h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary ${className}`}
  >
    <option value="">{label}</option>
    {children}
  </select>
);

const CaseCard: React.FC<{
  item: CreatorStudioCase;
  onSelect: (item: CreatorStudioCase) => void;
  onUseCase: (item: CreatorStudioCase) => void;
}> = ({ item, onSelect, onUseCase }) => (
  <article className="mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border border-border bg-surface align-top">
    <button type="button" className="block w-full text-left" onClick={() => onSelect(item)}>
      <div
        className="relative flex w-full items-center justify-center overflow-hidden bg-surface-raised"
        style={{
          aspectRatio: item.imageOriginal
            ? `${item.imageOriginal.width} / ${item.imageOriginal.height}`
            : '4 / 3',
        }}
      >
        <PlaceholderImage src={item.image} alt={item.imageAlt} fit="contain" className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent p-2">
          <div className="flex flex-wrap gap-1">
            {[item.category, ...item.styles.slice(0, 2), ...item.scenes.slice(0, 1)].map((tag) => (
              <span key={tag} className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 pb-2 pt-2">
        <div className="line-clamp-2 text-sm font-semibold leading-5">{item.title}</div>
      </div>
    </button>
    <div className="px-3 pb-3">
      <button
        type="button"
        onClick={() => onUseCase(item)}
        className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
      >
        <SparklesIcon className="h-3.5 w-3.5" />
        {i18nService.t('creatorUseCaseShort')}
      </button>
    </div>
  </article>
);

const TemplateLibrary: React.FC<{
  templates: CreatorStudioTemplate[];
  templateCasesById: Map<number, CreatorStudioCase>;
  onSelectTemplate: (template: CreatorStudioTemplate) => void;
  onUseTemplate: (template: CreatorStudioTemplate) => void;
}> = ({ templates, templateCasesById, onSelectTemplate, onUseTemplate }) => (
  <section
    className="grid gap-3 p-4"
    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))' }}
  >
    {templates.map((template) => {
      const exampleCases = template.exampleCases
        .map((sourceCaseId) => templateCasesById.get(sourceCaseId))
        .filter((item): item is CreatorStudioCase => Boolean(item));
      return (
        <article key={template.id} className="flex h-[34rem] max-h-[34rem] flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div className="relative h-[22rem] w-full shrink-0 overflow-hidden bg-surface-raised">
            <PlaceholderImage src={template.cover} alt={getText(template.title)} className="h-full w-full" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent p-2">
              <div className="flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <h2 className="line-clamp-1 text-base font-semibold">{getText(template.title)}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-secondary">{getText(template.description)}</p>
            <div className="mt-auto shrink-0 pt-2">
              <div className="text-xs text-muted">
                {i18nService.t('creatorExampleCases').replace('{count}', String(exampleCases.length))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectTemplate(template)}
                  className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-border px-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                >
                  {i18nService.t('creatorDetails')}
                </button>
                <button
                  type="button"
                  onClick={() => onUseTemplate(template)}
                  className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md bg-primary px-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  {i18nService.t('creatorUseTemplate')}
                </button>
              </div>
            </div>
          </div>
        </article>
      );
    })}
  </section>
);

const getSourceModeLabel = (mode: CreatorPromptSourceMode): string => {
  switch (mode) {
    case CreatorPromptSourceMode.CaseRemix:
      return i18nService.t('creatorSourceModeCaseRemix');
    case CreatorPromptSourceMode.TemplateDraft:
      return i18nService.t('creatorSourceModeTemplateDraft');
    case CreatorPromptSourceMode.RecipeDraft:
      return i18nService.t('creatorSourceModeRecipeDraft');
    case CreatorPromptSourceMode.AssetVariant:
      return i18nService.t('creatorSourceModeAssetVariant');
    case CreatorPromptSourceMode.NanoRemix:
      return i18nService.t('creatorSourceModeNanoRemix');
    case CreatorPromptSourceMode.Blank:
    default:
      return i18nService.t('creatorSourceModeBlank');
  }
};

const getSourceModeHint = (mode: CreatorPromptSourceMode): string => {
  switch (mode) {
    case CreatorPromptSourceMode.CaseRemix:
      return i18nService.t('creatorSourceModeCaseRemixHint');
    case CreatorPromptSourceMode.TemplateDraft:
      return i18nService.t('creatorSourceModeTemplateDraftHint');
    case CreatorPromptSourceMode.RecipeDraft:
      return i18nService.t('creatorSourceModeRecipeDraftHint');
    case CreatorPromptSourceMode.AssetVariant:
      return i18nService.t('creatorSourceModeAssetVariantHint');
    case CreatorPromptSourceMode.NanoRemix:
      return i18nService.t('creatorSourceModeNanoRemixHint');
    case CreatorPromptSourceMode.Blank:
    default:
      return i18nService.t('creatorSourceModeBlankHint');
  }
};

const getLintSeverityClass = (severity: CreatorPromptLintSeverity): string => {
  switch (severity) {
    case CreatorPromptLintSeverity.Error:
      return 'bg-red-500/10 text-red-600';
    case CreatorPromptLintSeverity.Warning:
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case CreatorPromptLintSeverity.Info:
    default:
      return 'bg-surface-raised text-muted';
  }
};

const getProductionIssueSeverityClass = (severity: CreatorProductionPackageIssueSeverity): string => {
  switch (severity) {
    case CreatorProductionPackageIssueSeverity.Blocker:
      return 'bg-red-500/10 text-red-600';
    case CreatorProductionPackageIssueSeverity.Warning:
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case CreatorProductionPackageIssueSeverity.Info:
    default:
      return 'bg-surface-raised text-muted';
  }
};

const getProductionIssueSeverityLabel = (severity: CreatorProductionPackageIssueSeverity): string => {
  switch (severity) {
    case CreatorProductionPackageIssueSeverity.Blocker:
      return i18nService.t('creatorProductionIssueSeverityBlocker');
    case CreatorProductionPackageIssueSeverity.Warning:
      return i18nService.t('creatorProductionIssueSeverityWarning');
    case CreatorProductionPackageIssueSeverity.Info:
    default:
      return i18nService.t('creatorProductionIssueSeverityInfo');
  }
};

const capitalizeLintSeverity = (severity: CreatorPromptLintSeverity): string => (
  severity.charAt(0).toUpperCase() + severity.slice(1)
);

const PromptBuilder: React.FC<{
  seed: CreatorPromptSeed | null;
  form: CreatorPromptForm;
  onFormChange: (form: CreatorPromptForm) => void;
  materials: CreatorBuilderMaterial[];
  onMaterialsChange: (materials: CreatorBuilderMaterial[]) => void;
  onOpenMaterialsInImageTools: (materials: CreatorBuilderMaterial[]) => void;
  onOpenBoard: () => void;
  onOpenBatch: () => void;
  onOpenImageTools: () => void;
  installedSkillIds: readonly string[];
  missingSkillIds: readonly string[];
  seedreamStatus: SeedreamStatus;
  isSendingToCowork: boolean;
  workspace: CreatorWorkspaceSnapshot | null;
  currentProjectId: string;
  recipes: CreatorRecipeRecord[];
  productionPackageSummary: CreatorProductionPackageSummary;
  onProjectChange: (projectId: string) => void;
  onCreateProject: (name: string) => Promise<void> | void;
  onUseRecipe: (recipe: CreatorRecipeRecord) => void;
  onSaveRecipe: (promptSpec: CreatorPromptSpec) => void;
  onImportRecipe: (recipeJson: string) => void;
  onScheduleRecipe: (recipe: CreatorRecipeRecord, cronExpression: string) => Promise<void> | void;
  onExportProductionPackage: () => void;
  onClearSource: () => void;
  onOpenSourceDetail: () => void;
  brandKit: CreatorBrandKitRecord | null;
  boardContextPack: string;
  onSendToCowork: (
    promptSpec: CreatorPromptSpec,
    promptText: string,
    materials: CreatorBuilderMaterial[],
    requestImageGeneration?: boolean
  ) => void;
  onSavePromptAsset: (promptSpec: CreatorPromptSpec, promptText: string) => void;
}> = ({
  seed,
  form,
  onFormChange,
  materials,
  onMaterialsChange,
  onOpenMaterialsInImageTools,
  onOpenBoard,
  onOpenBatch,
  onOpenImageTools,
  installedSkillIds,
  missingSkillIds,
  seedreamStatus,
  isSendingToCowork,
  workspace,
  currentProjectId,
  recipes,
  productionPackageSummary,
  onProjectChange,
  onCreateProject,
  onUseRecipe,
  onSaveRecipe,
  onImportRecipe,
  onScheduleRecipe,
  onExportProductionPackage,
  onClearSource,
  onOpenSourceDetail,
  brandKit,
  boardContextPack,
  onSendToCowork,
  onSavePromptAsset,
}) => {
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PromptBuilderPreviewTab>(PromptBuilderPreviewTab.Prompt);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [briefAutofillText, setBriefAutofillText] = useState('');
  const [briefAutofillMessage, setBriefAutofillMessage] = useState('');
  const [recipeImportText, setRecipeImportText] = useState('');
  const [isRecipeImportOpen, setIsRecipeImportOpen] = useState(false);
  const [recipeScheduleId, setRecipeScheduleId] = useState<string | null>(null);
  const [recipeScheduleCron, setRecipeScheduleCron] = useState(CreatorRecipeAutomationDefaultCron);
  const [isSchedulingRecipe, setIsSchedulingRecipe] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const promptLanguage = normalizePromptLanguage(i18nService.getLanguage(), form);
  const rawPromptSpec: CreatorPromptSpec = buildPromptSpec(seed, form, promptLanguage, i18nService.t('creatorBlankBuilder'), materials);
  const basePromptSpec = applyBoardAndBrandKit(rawPromptSpec, brandKit, boardContextPack);
  const promptSpec = selectCreatorCreativeDirection(basePromptSpec, selectedDirectionId);
  const compiledPrompt = compileCreatorPrompt({
    spec: promptSpec,
    target: CreatorPromptCompileTarget.CopyText,
  });
  const prompt = compiledPrompt.promptText;
  const promptSpecJson = JSON.stringify(compiledPrompt.promptSpec, null, 2);
  const lintResult = lintCreatorPromptSpec(promptSpec);
  const lintErrorCount = lintResult.issues.filter((issue) => issue.severity === CreatorPromptLintSeverity.Error).length;
  const lintWarningCount = lintResult.issues.filter((issue) => issue.severity === CreatorPromptLintSeverity.Warning).length;
  const lintInfoCount = lintResult.issues.filter((issue) => issue.severity === CreatorPromptLintSeverity.Info).length;
  const hasLintErrors = lintErrorCount > 0;
  const seedreamReady = seedreamStatus === SeedreamStatus.Configured;
  const seedreamHint = getSeedreamStatusHint(seedreamStatus);
  const sourceMode = promptSpec.sourceMode ?? CreatorPromptSourceMode.Blank;
  const templateFieldSchema = seed?.templateFieldSchema ?? [];
  const sourceCanOpen = sourceMode === CreatorPromptSourceMode.CaseRemix
    || sourceMode === CreatorPromptSourceMode.TemplateDraft
    || sourceMode === CreatorPromptSourceMode.AssetVariant
    || sourceMode === CreatorPromptSourceMode.NanoRemix;
  const templateUseWhen = seed?.templateUseWhen?.trim() ?? '';
  const templateGuidance = seed?.templateGuidance?.filter((item) => item.trim().length > 0) ?? [];
  const templatePitfalls = seed?.templatePitfalls?.filter((item) => item.trim().length > 0) ?? [];
  const hasTemplateMethodNotes = Boolean(templateUseWhen) || templateGuidance.length > 0 || templatePitfalls.length > 0;

  useEffect(() => {
    setSelectedDirectionId(null);
  }, [seed?.sourceId]);

  const updateField = (field: keyof CreatorPromptForm, value: string) => {
    onFormChange({ ...form, [field]: value });
  };

  const updateTemplateField = (fieldId: string, value: string) => {
    onFormChange({
      ...form,
      templateFieldValues: {
        ...form.templateFieldValues,
        [fieldId]: value,
      },
    });
  };

  const applyBriefAutofill = () => {
    const result = applyCreatorBriefAutofill(form, briefAutofillText);
    onFormChange(result.form);
    setBriefAutofillMessage(
      result.changedFields.length > 0
        ? i18nService.t('creatorBriefAutofillApplied').replace('{count}', String(result.changedFields.length))
        : i18nService.t('creatorBriefAutofillNoEmptyFields')
    );
  };

  const submitProject = async () => {
    if (!projectNameDraft.trim()) return;
    setIsCreatingProject(true);
    try {
      await onCreateProject(projectNameDraft);
      setProjectNameDraft('');
      setIsProjectFormOpen(false);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const openRecipeScheduleForm = (recipe: CreatorRecipeRecord) => {
    setRecipeScheduleId(recipe.id);
    setRecipeScheduleCron(CreatorRecipeAutomationDefaultCron);
  };

  const closeRecipeScheduleForm = () => {
    setRecipeScheduleId(null);
    setRecipeScheduleCron(CreatorRecipeAutomationDefaultCron);
  };

  const submitRecipeSchedule = async (recipe: CreatorRecipeRecord) => {
    if (!recipeScheduleCron.trim()) return;
    setIsSchedulingRecipe(true);
    try {
      await onScheduleRecipe(recipe, recipeScheduleCron);
      closeRecipeScheduleForm();
    } finally {
      setIsSchedulingRecipe(false);
    }
  };

  return (
    <section className="grid min-w-0 gap-4 p-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3 rounded-lg border border-border bg-surface p-4">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase text-muted">{i18nService.t('creatorBuilderSource')}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                  {getSourceModeLabel(sourceMode)}
                </span>
                {promptSpec.templateId && <span className="rounded-md bg-surface-raised px-2 py-1 text-[11px] text-muted">template: {promptSpec.templateId}</span>}
                {promptSpec.caseIds.length > 0 && <span className="rounded-md bg-surface-raised px-2 py-1 text-[11px] text-muted">cases: {promptSpec.caseIds.length}</span>}
              </div>
              <div className="mt-2 break-words text-sm font-semibold">{promptSpec.sourceTitle}</div>
              <p className="mt-1 text-xs leading-5 text-muted">{getSourceModeHint(sourceMode)}</p>
              {promptSpec.referenceAnalysis && (
                <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                  <div className="text-[11px] font-semibold uppercase text-muted">
                    {i18nService.t('creatorReferenceAnalysis')}
                  </div>
                  <ReferenceAnalysisSummary analysis={promptSpec.referenceAnalysis} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {isAdvancedOpen && (
                <button
                  type="button"
                  disabled={!currentProjectId}
                  onClick={() => onSaveRecipe(promptSpec)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={i18nService.t('creatorSaveAsRecipe')}
                  title={i18nService.t('creatorSaveAsRecipe')}
                >
                  <DocumentDuplicateIcon className="h-4 w-4" />
                </button>
              )}
              {sourceMode !== CreatorPromptSourceMode.Blank && (
                <>
                  {sourceCanOpen && (
                    <button
                      type="button"
                      onClick={onOpenSourceDetail}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                      aria-label={i18nService.t('creatorBuilderOpenSource')}
                      title={i18nService.t('creatorBuilderOpenSource')}
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClearSource}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                    aria-label={i18nService.t('creatorBuilderClearSource')}
                    title={i18nService.t('creatorBuilderClearSource')}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAdvancedOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <span>{i18nService.t('creatorBuilderAdvancedToggle')}</span>
          <span className="text-xs text-muted">
            {isAdvancedOpen ? i18nService.t('hide') : i18nService.t('show')}
          </span>
        </button>
        {isAdvancedOpen && (
          <>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-xs font-medium text-secondary">{i18nService.t('creatorBuilderProject')}</div>
          <div className="mt-2 flex gap-2">
            <select
              value={currentProjectId}
              onChange={(event) => onProjectChange(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs outline-none focus:border-primary"
              aria-label={i18nService.t('creatorProjectSelect')}
            >
              {!workspace && <option value="">{i18nService.t('loading')}</option>}
              {workspace?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {getCreatorProjectLabel(project.id, project.name)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsProjectFormOpen(true)}
              className="rounded-lg border border-border px-3 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {i18nService.t('creatorProjectCreate')}
            </button>
          </div>
          {isProjectFormOpen && (
            <div className="mt-2 flex gap-2">
              <input
                value={projectNameDraft}
                onChange={(event) => setProjectNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submitProject();
                  if (event.key === 'Escape') setIsProjectFormOpen(false);
                }}
                autoFocus
                placeholder={i18nService.t('projectNamePlaceholder')}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!projectNameDraft.trim() || isCreatingProject}
                onClick={() => void submitProject()}
                className="rounded-lg bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {i18nService.t('create')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProjectNameDraft('');
                  setIsProjectFormOpen(false);
                }}
                className="rounded-lg border border-border px-3 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                {i18nService.t('cancel')}
              </button>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-secondary">{i18nService.t('creatorRecipeLibrary')}</div>
            <button
              type="button"
              onClick={() => setIsRecipeImportOpen((open) => !open)}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {i18nService.t('creatorRecipeImport')}
            </button>
          </div>
          {isRecipeImportOpen && (
            <div className="mt-2 space-y-2">
              <textarea
                value={recipeImportText}
                onChange={(event) => setRecipeImportText(event.target.value)}
                rows={4}
                placeholder={i18nService.t('creatorRecipeImportPlaceholder')}
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecipeImportText('');
                    setIsRecipeImportOpen(false);
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                >
                  {i18nService.t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={!recipeImportText.trim()}
                  onClick={() => {
                    onImportRecipe(recipeImportText);
                    setRecipeImportText('');
                    setIsRecipeImportOpen(false);
                  }}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {i18nService.t('creatorRecipeImport')}
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {recipes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-muted">
                {i18nService.t('creatorRecipeEmpty')}
              </div>
            ) : recipes.slice(0, 6).map((recipe) => (
              <div key={recipe.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{recipe.title}</div>
                    <div className="mt-1 truncate text-[11px] text-muted">
                      {recipe.tags.slice(0, 4).join(', ') || i18nService.t('creatorRecipeNoTags')}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onUseRecipe(recipe)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-background hover:text-foreground"
                    >
                      {i18nService.t('creatorRecipeUse')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openRecipeScheduleForm(recipe)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-background hover:text-foreground"
                    >
                      {i18nService.t('creatorRecipeSchedule')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyText(JSON.stringify(recipe, null, 2))}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-background hover:text-foreground"
                    >
                      {i18nService.t('creatorRecipeExport')}
                    </button>
                  </div>
                </div>
                {recipeScheduleId === recipe.id && (
                  <div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-3">
                    <div>
                      <label className="text-[11px] font-medium text-secondary" htmlFor={`recipe-schedule-${recipe.id}`}>
                        {i18nService.t('creatorRecipeScheduleCronLabel')}
                      </label>
                      <input
                        id={`recipe-schedule-${recipe.id}`}
                        value={recipeScheduleCron}
                        onChange={(event) => setRecipeScheduleCron(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void submitRecipeSchedule(recipe);
                          if (event.key === 'Escape') closeRecipeScheduleForm();
                        }}
                        placeholder={CreatorRecipeAutomationDefaultCron}
                        className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs outline-none focus:border-primary"
                      />
                      <p className="mt-1 text-[11px] leading-4 text-muted">
                        {i18nService.t('creatorRecipeScheduleCronHelp')}
                      </p>
                    </div>
                    <div className="space-y-1 rounded-md bg-surface px-2 py-2 text-[11px] text-muted">
                      <div className="break-words">
                        <span className="font-medium text-secondary">{i18nService.t('creatorRecipeScheduleTaskName')}</span>
                        {' '}
                        {i18nService.t('creatorRecipeAutomationTaskName').replace('{title}', recipe.title)}
                      </div>
                      <div className="break-words">
                        <span className="font-medium text-secondary">{i18nService.t('creatorRecipeScheduleTaskDescription')}</span>
                        {' '}
                        {i18nService.t('creatorRecipeAutomationTaskDescription').replace('{id}', recipe.id)}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeRecipeScheduleForm}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                      >
                        {i18nService.t('cancel')}
                      </button>
                      <button
                        type="button"
                        disabled={!recipeScheduleCron.trim() || isSchedulingRecipe}
                        onClick={() => void submitRecipeSchedule(recipe)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {i18nService.t('creatorRecipeScheduleCreate')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-secondary">{i18nService.t('creatorProductionPackage')}</div>
              <p className="mt-1 text-xs leading-5 text-muted">{i18nService.t('creatorProductionPackageHint')}</p>
            </div>
            <button
              type="button"
              disabled={!currentProjectId}
              onClick={onExportProductionPackage}
              className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {i18nService.t('creatorProductionPackageExport')}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ProductionMetric label={i18nService.t('creatorProductionMetricAssets')} value={String(productionPackageSummary.stats.totalAssets)} />
            <ProductionMetric label={i18nService.t('creatorProductionMetricSelected')} value={String(productionPackageSummary.stats.selectedAssets)} />
            <ProductionMetric label={i18nService.t('creatorProductionMetricAdopted')} value={String(productionPackageSummary.stats.adoptedAssets)} />
            <ProductionMetric label={i18nService.t('creatorProductionMetricRecipes')} value={String(productionPackageSummary.stats.recipes)} />
            <ProductionMetric label={i18nService.t('creatorProductionMetricBatches')} value={String(productionPackageSummary.stats.batchRuns)} />
            <ProductionMetric label={i18nService.t('creatorProductionMetricCompletion')} value={`${productionPackageSummary.stats.completionRate}%`} />
          </div>
          <div className="mt-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase text-muted">{i18nService.t('creatorProductionPerformance')}</div>
            <div className="grid gap-2">
              <ProductionPerformanceList
                title={i18nService.t('creatorProductionPerformanceTemplates')}
                items={productionPackageSummary.performance.byTemplate}
              />
              <ProductionPerformanceList
                title={i18nService.t('creatorProductionPerformanceModels')}
                items={productionPackageSummary.performance.byModel}
              />
              <ProductionPerformanceList
                title={i18nService.t('creatorProductionPerformanceDirections')}
                items={productionPackageSummary.performance.byDirection}
              />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase text-muted">{i18nService.t('creatorProductionPackageGovernance')}</div>
            {productionPackageSummary.issues.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
                {i18nService.t('creatorProductionPackageNoIssues')}
              </div>
            ) : productionPackageSummary.issues.slice(0, 5).map((issue) => (
              <div key={issue.code} className="rounded-lg border border-border bg-surface p-2">
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${getProductionIssueSeverityClass(issue.severity)}`}>
                    {getProductionIssueSeverityLabel(issue.severity)}
                  </span>
                  <p className="min-w-0 text-xs leading-5 text-secondary">
                    {i18nService.t(issue.messageKey).replace('{count}', String(issue.count))}
                  </p>
                </div>
              </div>
            ))}
            {productionPackageSummary.issues.length > 5 && (
              <div className="text-xs text-muted">
                {i18nService.t('creatorProductionPackageMoreIssues').replace('{count}', String(productionPackageSummary.issues.length - 5))}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-xs font-medium text-secondary">{i18nService.t('creatorBuilderAdvancedEntrypoints')}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={onOpenBoard}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {i18nService.t('creatorBoardTab')}
            </button>
            <button
              type="button"
              onClick={onOpenBatch}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {i18nService.t('creatorBatchTab')}
            </button>
            <button
              type="button"
              onClick={onOpenImageTools}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {i18nService.t('creatorImageToolsTab')}
            </button>
          </div>
        </div>
          </>
        )}
        <BuilderSection title={i18nService.t('creatorBuilderSectionBrief')}>
          <label className="block">
            <span className="text-xs font-medium text-secondary">{i18nService.t('creatorBriefAutofill')}</span>
            <textarea
              value={briefAutofillText}
              onChange={(event) => {
                setBriefAutofillText(event.target.value);
                setBriefAutofillMessage('');
              }}
              rows={3}
              placeholder={i18nService.t('creatorBriefAutofillPlaceholder')}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!briefAutofillText.trim()}
              onClick={applyBriefAutofill}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {i18nService.t('creatorBriefAutofillApply')}
            </button>
            {briefAutofillMessage && <span className="text-xs text-muted">{briefAutofillMessage}</span>}
          </div>
        </BuilderSection>
        <BuilderSection title={i18nService.t('creatorBuilderSectionCoreInputs')}>
          <BuilderInput label={i18nService.t('creatorFieldSubject')} value={form.subject} onChange={(value) => updateField('subject', value)} />
          <BuilderInput label={i18nService.t('creatorFieldPlatform')} value={form.platform} onChange={(value) => updateField('platform', value)} />
          <BuilderInput label={i18nService.t('creatorFieldAspectRatio')} value={form.aspectRatio} onChange={(value) => updateField('aspectRatio', value)} />
          <BuilderInput label={i18nService.t('creatorFieldRequiredText')} value={form.requiredText} onChange={(value) => updateField('requiredText', value)} />
        </BuilderSection>
        {isAdvancedOpen && (
          <>
            {templateFieldSchema.length > 0 && (
              <BuilderSection title={i18nService.t('creatorBuilderSectionTemplateFields')}>
                <p className="text-xs leading-5 text-muted">{i18nService.t('creatorBuilderTemplateFieldsHint')}</p>
                {templateFieldSchema.map((field) => (
                  <TemplateFieldInput
                    key={field.id}
                    field={field}
                    value={form.templateFieldValues[field.id] ?? ''}
                    onChange={(value) => updateTemplateField(field.id, value)}
                  />
                ))}
              </BuilderSection>
            )}
            {hasTemplateMethodNotes && (
              <BuilderSection title={i18nService.t('creatorBuilderSectionTemplateMethod')}>
                {templateUseWhen && (
                  <BuilderNoteList title={i18nService.t('creatorUseWhen')} items={[templateUseWhen]} />
                )}
                {templateGuidance.length > 0 && (
                  <BuilderNoteList title={i18nService.t('creatorGuidance')} items={templateGuidance} />
                )}
                {templatePitfalls.length > 0 && (
                  <BuilderNoteList title={i18nService.t('creatorPitfalls')} items={templatePitfalls} />
                )}
              </BuilderSection>
            )}
            <BuilderSection title={i18nService.t('creatorBuilderSectionAdvancedPrompt')}>
              <BuilderInput label={i18nService.t('creatorFieldVisualStyle')} value={form.visualStyle} onChange={(value) => updateField('visualStyle', value)} />
              <BuilderInput label={i18nService.t('creatorFieldTaskType')} value={form.taskType} onChange={(value) => updateField('taskType', value)} />
              <BuilderInput label={i18nService.t('creatorFieldAudience')} value={form.audience} onChange={(value) => updateField('audience', value)} />
              <BuilderInput label={i18nService.t('creatorFieldMainObject')} value={form.mainObject} onChange={(value) => updateField('mainObject', value)} />
              <BuilderInput label={i18nService.t('creatorFieldOutputCount')} value={form.outputCount} onChange={(value) => updateField('outputCount', value)} />
              <BuilderInput label={i18nService.t('creatorFieldColorPreference')} value={form.colorPreference} onChange={(value) => updateField('colorPreference', value)} />
              <BuilderTextarea label={i18nService.t('creatorFieldNegative')} value={form.negativeRequirements} onChange={(value) => updateField('negativeRequirements', value)} />
            </BuilderSection>
          </>
        )}
        <BuilderSection title={i18nService.t('creatorBuilderSectionMaterials')}>
          <MaterialTray
            materials={materials}
            onMaterialsChange={onMaterialsChange}
            onOpenMaterialsInImageTools={onOpenMaterialsInImageTools}
          />
        </BuilderSection>
      </div>
      <div className="min-w-0 space-y-4">
        <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">{i18nService.t('creatorBuilderNextStepTitle')}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">{i18nService.t('creatorBuilderNextStepHint')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSendingToCowork || hasLintErrors}
              title={hasLintErrors ? i18nService.t('creatorPromptLintBlocksExecution') : undefined}
              onClick={() => onSendToCowork(promptSpec, prompt, materials)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              {isSendingToCowork ? i18nService.t('creatorSendingToCowork') : i18nService.t('creatorSendToCowork')}
            </button>
            <button
              type="button"
              disabled={!seedreamReady || isSendingToCowork || hasLintErrors}
              title={hasLintErrors ? i18nService.t('creatorPromptLintBlocksExecution') : i18nService.t('creatorGenerateWithSeedreamHint')}
              onClick={() => onSendToCowork(promptSpec, prompt, materials, true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55"
            >
              <SparklesIcon className="h-4 w-4" />
              {i18nService.t('creatorGenerateWithSeedream')}
            </button>
          </div>
          {hasLintErrors && (
            <p className="mt-3 text-xs leading-5 text-red-600 dark:text-red-300">
              {i18nService.t('creatorPromptLintBlocksExecution')}
            </p>
          )}
        </div>
        {isAdvancedOpen && (
          <>
        <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{i18nService.t('creatorPromptQuality')}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {i18nService.t('creatorPromptQualitySummary')
                  .replace('{score}', String(lintResult.score))
                  .replace('{errors}', String(lintErrorCount))
                  .replace('{warnings}', String(lintWarningCount))
                  .replace('{info}', String(lintInfoCount))}
              </p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-medium ${hasLintErrors ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary'}`}>
              {lintResult.score}/100
            </span>
          </div>
          {isAdvancedOpen && lintResult.issues.length > 0 ? (
            <div className="mt-3 space-y-2">
              {lintResult.issues.map((issue) => (
                <div key={`${issue.code}-${issue.fieldPath}`} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${getLintSeverityClass(issue.severity)}`}>
                      {i18nService.t(`creatorPromptLintSeverity${capitalizeLintSeverity(issue.severity)}`)}
                    </span>
                    <span className="text-xs font-medium text-secondary">{issue.fieldPath}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-secondary">{i18nService.t(issue.messageKey)}</p>
                  {issue.suggestionKey && <p className="mt-1 text-xs leading-5 text-muted">{i18nService.t(issue.suggestionKey)}</p>}
                </div>
              ))}
            </div>
          ) : isAdvancedOpen ? (
            <p className="mt-3 text-xs leading-5 text-muted">{i18nService.t('creatorPromptQualityClean')}</p>
          ) : null}
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{i18nService.t('creatorPromptPreview')}</h2>
              {isAdvancedOpen && (
                <div className="inline-flex rounded-lg border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab(PromptBuilderPreviewTab.Prompt)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${previewTab === PromptBuilderPreviewTab.Prompt ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-raised hover:text-foreground'}`}
                >
                  {i18nService.t('creatorPromptPreviewFinal')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab(PromptBuilderPreviewTab.Spec)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${previewTab === PromptBuilderPreviewTab.Spec ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-raised hover:text-foreground'}`}
                >
                  {i18nService.t('creatorPromptPreviewSpec')}
                </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {isAdvancedOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => void copyText(previewTab === PromptBuilderPreviewTab.Prompt ? prompt : promptSpecJson)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    {previewTab === PromptBuilderPreviewTab.Prompt ? i18nService.t('creatorCopyPrompt') : i18nService.t('copy')}
                  </button>
                  <button
                    type="button"
                    disabled={!currentProjectId}
                    onClick={() => onSavePromptAsset(promptSpec, prompt)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <DocumentDuplicateIcon className="h-4 w-4" />
                    {i18nService.t('creatorSavePromptAsset')}
                  </button>
                  <button
                    type="button"
                    disabled={!currentProjectId}
                    onClick={() => onSaveRecipe(promptSpec)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <DocumentDuplicateIcon className="h-4 w-4" />
                    {i18nService.t('creatorSaveAsRecipe')}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={isSendingToCowork || hasLintErrors}
                title={hasLintErrors ? i18nService.t('creatorPromptLintBlocksExecution') : undefined}
                onClick={() => onSendToCowork(promptSpec, prompt, materials)}
                className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RocketLaunchIcon className="h-4 w-4" />
                {isSendingToCowork ? i18nService.t('creatorSendingToCowork') : i18nService.t('creatorSendToCowork')}
              </button>
              {isAdvancedOpen && (
                <button
                  type="button"
                  disabled={!seedreamReady || isSendingToCowork || hasLintErrors}
                  title={hasLintErrors ? i18nService.t('creatorPromptLintBlocksExecution') : i18nService.t('creatorGenerateWithSeedreamHint')}
                  onClick={() => onSendToCowork(promptSpec, prompt, materials, true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {i18nService.t('creatorGenerateWithSeedream')}
                </button>
              )}
            </div>
          </div>
          <pre className="max-h-[420px] max-w-full whitespace-pre-wrap break-words overflow-auto p-4 text-sm leading-6 text-foreground">
            {isAdvancedOpen && previewTab === PromptBuilderPreviewTab.Spec ? promptSpecJson : prompt}
          </pre>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{i18nService.t('creatorContextPack')}</h2>
          </div>
          <pre className="max-h-56 max-w-full whitespace-pre-wrap break-words overflow-auto p-4 text-xs leading-5 text-secondary">
            {promptSpec.contextPack || i18nService.t('creatorContextPackEmpty')}
          </pre>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{i18nService.t('creatorCreativeDirections')}</h2>
          </div>
          <div className="grid gap-2 p-4 md:grid-cols-2">
            {basePromptSpec.creativeDirections?.map((direction) => {
              const selected = direction.id === selectedDirectionId;
              return (
                <div
                  key={direction.id}
                  className={`rounded-lg border p-3 ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-surface-raised'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{direction.title}</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedDirectionId(direction.id)}
                      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        selected
                          ? 'bg-primary text-white'
                          : 'border border-border text-secondary hover:bg-surface hover:text-foreground'
                      }`}
                    >
                      {selected ? i18nService.t('creatorDirectionSelected') : i18nService.t('creatorUseDirection')}
                    </button>
                  </div>
                  <p className="mt-1 break-words text-xs text-secondary">{direction.template}</p>
                  <p className="mt-2 break-words text-xs text-muted">{direction.reason}</p>
                  <p className="mt-2 break-words text-xs text-secondary">{direction.promptFocus}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">{i18nService.t('creatorRecommendedRuntime')}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">{i18nService.t('creatorRecommendedRuntimeHint')}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...installedSkillIds, ...missingSkillIds].map((skillId) => {
              const isInstalled = installedSkillIds.includes(skillId);
              return (
                <span
                  key={skillId}
                  className={`rounded-md px-2 py-1 text-[11px] ${
                    isInstalled
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-raised text-muted'
                  }`}
                >
                  {skillId}{isInstalled ? '' : ` · ${i18nService.t('creatorSkillMissing')}`}
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">{seedreamHint}</p>
        </div>
          </>
        )}
      </div>
    </section>
  );
};

const getSeedreamStatusHint = (status: SeedreamStatus): string => {
  switch (status) {
    case SeedreamStatus.Configured:
      return i18nService.t('creatorSeedreamConfiguredHint');
    case SeedreamStatus.Checking:
      return i18nService.t('creatorSeedreamCheckingHint');
    case SeedreamStatus.NeedsConfig:
      return i18nService.t('creatorSeedreamConfigRequired');
    case SeedreamStatus.Missing:
    default:
      return i18nService.t('creatorSeedreamMissingHint');
  }
};

const applyBoardAndBrandKit = (
  spec: CreatorPromptSpec,
  brandKit: CreatorBrandKitRecord | null,
  boardContextPack: string
): CreatorPromptSpec => {
  const brandKitLines = brandKit && (
    brandKit.colors.length > 0
    || brandKit.logoPath
    || brandKit.logoAssetId
    || brandKit.bannedWords.length > 0
    || brandKit.tone
    || brandKit.visualPreferences
  )
    ? [
      i18nService.t('creatorBrandKitContextHeader'),
      brandKit.colors.length > 0 ? `${i18nService.t('creatorBrandColors')}: ${brandKit.colors.join(', ')}` : '',
      brandKit.logoPath || brandKit.logoAssetId ? `${i18nService.t('creatorBrandLogoPath')}: ${brandKit.logoPath || brandKit.logoAssetId}` : '',
      brandKit.tone ? `${i18nService.t('creatorBrandTone')}: ${brandKit.tone}` : '',
      brandKit.visualPreferences ? `${i18nService.t('creatorBrandVisualPreferences')}: ${brandKit.visualPreferences}` : '',
      brandKit.bannedWords.length > 0 ? `${i18nService.t('creatorBrandBannedWords')}: ${brandKit.bannedWords.join(', ')}` : '',
    ].filter(Boolean).join('\n')
    : '';
  const contextPack = [
    spec.contextPack,
    boardContextPack ? `${i18nService.t('creatorBoardContextPackHeader')}\n${boardContextPack}` : '',
    brandKitLines,
  ].filter(Boolean).join('\n\n');
  const brandNegative = brandKit?.bannedWords.length
    ? `${i18nService.t('creatorBrandBannedWords')}: ${brandKit.bannedWords.join(', ')}`
    : '';
  const visualStyle = [
    spec.visualStyle,
    brandKit?.visualPreferences,
    brandKit?.colors.length ? `${i18nService.t('creatorBrandColors')}: ${brandKit.colors.join(', ')}` : '',
    brandKit?.tone ? `${i18nService.t('creatorBrandTone')}: ${brandKit.tone}` : '',
  ].filter(Boolean).join('; ');
  return {
    ...spec,
    visualStyle,
    constraints: {
      ...spec.constraints,
      negativeRequirements: [
        spec.constraints.negativeRequirements,
        brandNegative,
      ].filter(Boolean).join('\n'),
    },
    contextPack,
  };
};

const createMaterialId = (): string => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `material-${Date.now()}-${Math.random().toString(16).slice(2)}`
);

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

const getFilePath = (file: File, source: CreatorMaterialSource): string => {
  const fileWithPath = file as File & { path?: string };
  if (fileWithPath.path?.trim()) {
    return fileWithPath.path.trim();
  }
  return `${source}:${file.name || `image-${Date.now()}`}`;
};

const getFileSystemPath = (file: File): string | null => {
  const fileWithPath = file as File & { path?: string };
  const filePath = fileWithPath.path?.trim();
  return filePath || null;
};

const isImportableLocalPath = (filePath: string): boolean => {
  const value = filePath.trim();
  return Boolean(value)
    && !value.startsWith('file:')
    && !value.startsWith('data:')
    && !value.startsWith('http:')
    && !value.startsWith('https:')
    && (!/^[a-z_]+:/i.test(value) || /^[a-z]:[\\/]/i.test(value));
};

const encodeLocalFileSrc = (filePath: string): string => {
  const raw = filePath.trim();
  const normalized = raw.replace(/\\/g, '/');
  const fileUrl = /^file:\/\//i.test(normalized)
    ? normalized
    : normalized.startsWith('/')
      ? `file://${normalized}`
      : `file:///${normalized}`;
  return encodeURI(fileUrl)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/^file:\/\//i, 'localfile://');
};

const colorChannelToHex = (value: number): string => value.toString(16).padStart(2, '0');

const rgbToHex = (red: number, green: number, blue: number): string => (
  `#${colorChannelToHex(red)}${colorChannelToHex(green)}${colorChannelToHex(blue)}`
);

const getCommonDivisor = (left: number, right: number): number => {
  let a = Math.max(1, Math.round(left));
  let b = Math.max(1, Math.round(right));
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};

const getImageOrientation = (width: number, height: number): CreatorMaterialImageAnalysis['orientation'] => (
  Math.abs(width - height) <= Math.max(width, height) * 0.04
    ? 'square'
    : width > height ? 'landscape' : 'portrait'
);

const getImageAspectRatio = (width: number, height: number): string => {
  const divisor = getCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};

const getImageBrightness = (averageLuminance: number): CreatorMaterialImageAnalysis['brightness'] => {
  if (averageLuminance < 82) return 'dark';
  if (averageLuminance > 174) return 'bright';
  return 'balanced';
};

const getImageContrast = (luminanceDeviation: number): CreatorMaterialImageAnalysis['contrast'] => {
  if (luminanceDeviation < 28) return 'low';
  if (luminanceDeviation > 60) return 'high';
  return 'medium';
};

const getImageColorMood = (
  warmPixelCount: number,
  coolPixelCount: number,
  sampleCount: number
): CreatorMaterialImageAnalysis['colorMood'] => {
  if (sampleCount === 0) return 'neutral';
  const warmRatio = warmPixelCount / sampleCount;
  const coolRatio = coolPixelCount / sampleCount;
  if (warmRatio > 0.25 && coolRatio > 0.25) return 'mixed';
  if (warmRatio > coolRatio + 0.12) return 'warm';
  if (coolRatio > warmRatio + 0.12) return 'cool';
  return 'neutral';
};

const analyzeImageDataUrl = (dataUrl: string): Promise<CreatorMaterialImageAnalysis | undefined> => new Promise((resolve) => {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    resolve(undefined);
    return;
  }
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    const sampleSize = 24;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const context = canvas.getContext('2d');
    if (!context) {
      resolve(undefined);
      return;
    }
    context.drawImage(image, 0, 0, sampleSize, sampleSize);
    const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
    const colorBuckets = new Map<string, number>();
    const luminanceValues: number[] = [];
    let warmPixelCount = 0;
    let coolPixelCount = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha < 180) continue;
      const originalRed = pixels[index];
      const originalGreen = pixels[index + 1];
      const originalBlue = pixels[index + 2];
      const luminance = originalRed * 0.2126 + originalGreen * 0.7152 + originalBlue * 0.0722;
      luminanceValues.push(luminance);
      if (originalRed - originalBlue > 24) {
        warmPixelCount += 1;
      } else if (originalBlue - originalRed > 24) {
        coolPixelCount += 1;
      }
      const red = Math.round(pixels[index] / 32) * 32;
      const green = Math.round(pixels[index + 1] / 32) * 32;
      const blue = Math.round(pixels[index + 2] / 32) * 32;
      const color = rgbToHex(Math.min(red, 255), Math.min(green, 255), Math.min(blue, 255));
      colorBuckets.set(color, (colorBuckets.get(color) ?? 0) + 1);
    }
    const dominantColors = [...colorBuckets.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([color]) => color);
    const averageLuminance = luminanceValues.length > 0
      ? luminanceValues.reduce((sum, value) => sum + value, 0) / luminanceValues.length
      : 128;
    const luminanceDeviation = luminanceValues.length > 0
      ? Math.sqrt(luminanceValues.reduce((sum, value) => sum + ((value - averageLuminance) ** 2), 0) / luminanceValues.length)
      : 0;
    resolve({
      width: image.naturalWidth,
      height: image.naturalHeight,
      dominantColors,
      orientation: getImageOrientation(image.naturalWidth, image.naturalHeight),
      aspectRatio: getImageAspectRatio(image.naturalWidth, image.naturalHeight),
      brightness: getImageBrightness(averageLuminance),
      contrast: getImageContrast(luminanceDeviation),
      colorMood: getImageColorMood(warmPixelCount, coolPixelCount, luminanceValues.length),
    });
  };
  image.onerror = () => resolve(undefined);
  image.src = dataUrl;
});

const createMaterialFromFile = async (
  file: File,
  source: CreatorMaterialSource,
  role: CreatorMaterialRole = CreatorMaterialRole.Reference
): Promise<CreatorBuilderMaterial> => {
  const dataUrl = await readFileAsDataUrl(file);
  const imageAnalysis = await analyzeImageDataUrl(dataUrl);
  return {
    id: createMaterialId(),
    role,
    source,
    name: file.name || `image-${Date.now()}.png`,
    path: getFilePath(file, source),
    mimeType: file.type || 'image/png',
    size: file.size,
    previewUrl: dataUrl,
    dataUrl,
    imageAnalysis,
    addedAt: Date.now(),
  };
};

const MaterialTray: React.FC<{
  materials: CreatorBuilderMaterial[];
  onMaterialsChange: (materials: CreatorBuilderMaterial[]) => void;
  onOpenMaterialsInImageTools?: (materials: CreatorBuilderMaterial[]) => void;
}> = ({ materials, onMaterialsChange, onOpenMaterialsInImageTools }) => {
  const language = i18nService.getLanguage();
  const roleOptions = Object.values(CreatorMaterialRole);

  const addFiles = useCallback(async (files: FileList | File[], source: CreatorMaterialSource) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const newMaterials = await Promise.all(imageFiles.map((file) => createMaterialFromFile(file, source)));
    onMaterialsChange([...materials, ...newMaterials]);
  }, [materials, onMaterialsChange]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
      if (files.length === 0) return;
      event.preventDefault();
      void addFiles(files, CreatorMaterialSource.Clipboard);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  const updateRole = (id: string, role: CreatorMaterialRole) => {
    onMaterialsChange(materials.map((material) => material.id === id ? { ...material, role } : material));
  };

  const removeMaterial = (id: string) => {
    onMaterialsChange(materials.filter((material) => material.id !== id));
  };

  const moveMaterial = (id: string, direction: -1 | 1) => {
    const index = materials.findIndex((material) => material.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= materials.length) return;
    const nextMaterials = [...materials];
    const [item] = nextMaterials.splice(index, 1);
    nextMaterials.splice(nextIndex, 0, item);
    onMaterialsChange(nextMaterials);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void addFiles(event.dataTransfer.files, CreatorMaterialSource.File);
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium text-secondary">{i18nService.t('creatorMaterialTray')}</div>
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="mt-2 flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-raised px-3 py-4 text-center"
        >
          <PhotoIcon className="h-8 w-8 text-muted" />
          <p className="mt-2 text-xs leading-5 text-muted">{i18nService.t('creatorMaterialDropHint')}</p>
        </div>
      </div>
      {materials.length > 0 && (
        <div className="space-y-2">
          {onOpenMaterialsInImageTools && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onOpenMaterialsInImageTools(materials)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <WrenchScrewdriverIcon className="h-4 w-4" />
                {i18nService.t('creatorMaterialOpenImageTools')}
              </button>
            </div>
          )}
          {materials.map((material, index) => (
            <div key={material.id} className="grid grid-cols-[56px_1fr_auto] gap-2 rounded-lg border border-border bg-background p-2">
              <img
                src={material.previewUrl}
                alt={material.name}
                className="h-14 w-14 rounded-md bg-surface-raised object-cover"
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{material.name}</div>
                <div className="truncate text-[11px] text-muted">{material.path}</div>
                {material.imageAnalysis && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <span>{material.imageAnalysis.width}x{material.imageAnalysis.height}</span>
                    {material.imageAnalysis.dominantColors.map((color) => (
                      <span
                        key={color}
                        className="h-3 w-3 rounded-sm border border-border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
                <select
                  value={material.role}
                  onChange={(event) => updateRole(material.id, event.target.value as CreatorMaterialRole)}
                  className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-xs"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {CREATOR_MATERIAL_ROLE_LABELS[role][language]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveMaterial(material.id, -1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-30"
                  aria-label={i18nService.t('creatorMaterialMoveUp')}
                >
                  <ArrowUpIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={index === materials.length - 1}
                  onClick={() => moveMaterial(material.id, 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-30"
                  aria-label={i18nService.t('creatorMaterialMoveDown')}
                >
                  <ArrowDownIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeMaterial(material.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-red-500/10 hover:text-red-600"
                  aria-label={i18nService.t('creatorMaterialRemove')}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProductionMetric: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-surface p-2">
    <div className="truncate text-[11px] text-muted">{label}</div>
    <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
  </div>
);

const ProductionPerformanceList: React.FC<{
  title: string;
  items: CreatorProductionPerformanceGroup[];
}> = ({ title, items }) => {
  const visibleItems = items.slice(0, 3);
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-secondary">{title}</div>
        <div className="text-[10px] text-muted">{i18nService.t('creatorProductionPerformanceScore')}</div>
      </div>
      {visibleItems.length === 0 ? (
        <div className="mt-2 text-xs text-muted">{i18nService.t('creatorProductionPerformanceEmpty')}</div>
      ) : (
        <div className="mt-2 space-y-1.5">
          {visibleItems.map((item) => (
            <div key={item.id} className="min-w-0 rounded-md bg-background px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-xs font-medium text-secondary" title={item.label}>
                  {item.label}
                </div>
                <div className="shrink-0 text-[11px] font-semibold text-primary">{item.score}</div>
              </div>
              <div className="mt-1 truncate text-[11px] text-muted">
                {i18nService.t('creatorProductionPerformanceLine')
                  .replace('{adopted}', String(item.adoptedAssets))
                  .replace('{selected}', String(item.selectedAssets))
                  .replace('{completed}', String(item.completedBatchTasks))
                  .replace('{failed}', String(item.failedBatchTasks))
                  .replace('{rate}', `${item.completionRate}%`)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BuilderInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="block">
    <span className="text-xs font-medium text-secondary">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
    />
  </label>
);

const BuilderSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="space-y-3 rounded-lg border border-border bg-background p-3">
    <h3 className="text-xs font-semibold uppercase text-muted">{title}</h3>
    {children}
  </section>
);

const BuilderNoteList: React.FC<{
  title: string;
  items: string[];
}> = ({ title, items }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase text-muted">{title}</div>
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="break-words rounded-md bg-surface px-2 py-1.5 text-xs leading-5 text-secondary">
          {item}
        </li>
      ))}
    </ul>
  </div>
);

const ReferenceAnalysisSummary: React.FC<{
  analysis: CreatorPromptReferenceAnalysis;
}> = ({ analysis }) => {
  const rows = [
    analysis.aspectRatio ? `${i18nService.t('creatorReferenceAnalysisAspectRatio')}: ${analysis.aspectRatio}` : '',
    ...analysis.structure.slice(0, 2),
    ...analysis.styleNotes.slice(0, 2),
    ...analysis.textNotes.slice(0, 1),
    ...analysis.constraintNotes.slice(0, 1),
  ].filter(Boolean);
  if (rows.length === 0) {
    return <p className="mt-2 text-xs leading-5 text-muted">{i18nService.t('creatorReferenceAnalysisEmpty')}</p>;
  }
  return (
    <ul className="mt-2 space-y-1">
      {rows.map((row, index) => (
        <li key={`${index}-${row}`} className="break-words text-xs leading-5 text-secondary">
          {row}
        </li>
      ))}
    </ul>
  );
};

const BuilderTextarea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="block">
    <span className="text-xs font-medium text-secondary">{label}</span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
    />
  </label>
);

const TemplateFieldInput: React.FC<{
  field: CreatorTemplateFieldSchema;
  value: string;
  onChange: (value: string) => void;
}> = ({ field, value, onChange }) => {
  const language = i18nService.getLanguage();
  const label = field.label[language];
  const placeholder = field.placeholder?.[language] ?? '';
  const help = field.help?.[language] ?? '';
  if (field.kind === CreatorTemplateFieldKind.Textarea) {
    return (
      <label className="block">
        <span className="text-xs font-medium text-secondary">{label}</span>
        {help && <span className="mt-1 block text-[11px] leading-4 text-muted">{help}</span>}
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>
    );
  }
  if (field.kind === CreatorTemplateFieldKind.Select) {
    return (
      <label className="block">
        <span className="text-xs font-medium text-secondary">{label}</span>
        {help && <span className="mt-1 block text-[11px] leading-4 text-muted">{help}</span>}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">{i18nService.t('creatorTemplateFieldEmpty')}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label[language]}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="block">
      <span className="text-xs font-medium text-secondary">{label}</span>
      {help && <span className="mt-1 block text-[11px] leading-4 text-muted">{help}</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
};

const CaseDrawer: React.FC<{
  item: CreatorStudioCase;
  onClose: () => void;
  onUseCase: (item: CreatorStudioCase) => void;
  onSaveCase: (item: CreatorStudioCase) => void;
}> = ({ item, onClose, onUseCase, onSaveCase }) => (
  <Drawer onClose={onClose} title={item.title}>
    <div className="rounded-lg bg-surface-raised p-2">
      <PlaceholderImage src={item.image} alt={item.imageAlt} fit="contain" className="max-h-[70vh] w-full rounded-md" />
    </div>
    <ImageMetadataPanel item={item} />
    <div className="mt-4 flex flex-wrap gap-1.5">
      {[item.category, ...item.styles, ...item.scenes].map((tag) => (
        <span key={tag} className="rounded-md bg-surface-raised px-2 py-0.5 text-xs text-secondary">{tag}</span>
      ))}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => void copyText(item.prompt)} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
        {i18nService.t('creatorCopyPrompt')}
      </button>
      <button type="button" onClick={() => onUseCase(item)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary">
        {i18nService.t('creatorUseCase')}
      </button>
      <button type="button" onClick={() => onSaveCase(item)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary">
        {i18nService.t('creatorSaveCaseAsset')}
      </button>
    </div>
    <InfoLinks sourceUrl={item.sourceUrl} githubUrl={item.githubUrl} />
    <section className="mt-4">
      <h3 className="text-sm font-semibold">{i18nService.t('creatorFullPrompt')}</h3>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-raised p-3 text-xs leading-5 text-secondary">{item.prompt}</pre>
    </section>
    <p className="mt-4 text-xs leading-5 text-muted">{i18nService.t('creatorDisclaimer')}</p>
  </Drawer>
);

const ImageMetadataPanel: React.FC<{
  item: CreatorStudioCase;
}> = ({ item }) => (
  <section className="mt-4 grid grid-cols-2 gap-2">
    <ImageMetadataItem label={i18nService.t('creatorOriginalImage')} value={formatImageDimensions(item.imageOriginal)} />
    <ImageMetadataItem label={i18nService.t('creatorThumbnailImage')} value={formatImageDimensions(item.imageThumbnail)} />
    <ImageMetadataItem label={i18nService.t('creatorImageAspectRatio')} value={formatImageAspectRatio(item.imageOriginal)} />
    <ImageMetadataItem label={i18nService.t('creatorImageCropStatus')} value={i18nService.t('creatorImageNotCropped')} />
    <ImageMetadataItem label={i18nService.t('creatorImageFileSize')} value={formatImageFileSize(item.imageOriginal)} />
    <ImageMetadataItem label={i18nService.t('creatorImageMimeType')} value={item.imageOriginal?.mimeType ?? i18nService.t('creatorImageUnknown')} />
  </section>
);

const ImageMetadataItem: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-surface p-3">
    <div className="text-[11px] font-medium uppercase text-muted">{label}</div>
    <div className="mt-1 text-sm tabular-nums text-foreground">{value}</div>
  </div>
);

const TemplateDrawer: React.FC<{
  template: CreatorStudioTemplate;
  templateCasesById: Map<number, CreatorStudioCase>;
  onClose: () => void;
  onUseTemplate: (template: CreatorStudioTemplate) => void;
  onOpenExampleCase: (sourceCaseId: number) => void;
}> = ({ template, templateCasesById, onClose, onUseTemplate, onOpenExampleCase }) => (
  <Drawer onClose={onClose} title={getText(template.title)}>
    <PlaceholderImage src={template.cover} alt={getText(template.title)} className="aspect-[4/3] w-full rounded-lg" />
    <p className="mt-4 text-sm leading-6 text-secondary">{getText(template.description)}</p>
    <button type="button" onClick={() => onUseTemplate(template)} className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
      {i18nService.t('creatorUseTemplate')}
    </button>
    <TemplateSection title={i18nService.t('creatorUseWhen')} items={[getText(template.useWhen)]} />
    <TemplateSection title={i18nService.t('creatorGuidance')} items={template.guidance[i18nService.getLanguage()]} />
    <TemplateSection title={i18nService.t('creatorPitfalls')} items={template.pitfalls[i18nService.getLanguage()]} />
    <section className="mt-5">
      <h3 className="text-sm font-semibold">{i18nService.t('creatorExampleCaseList')}</h3>
      <div className="mt-2 space-y-2">
        {template.exampleCases.map((sourceCaseId) => {
          const item = templateCasesById.get(sourceCaseId);
          if (!item) return null;
          return (
            <button
              key={sourceCaseId}
              type="button"
              onClick={() => onOpenExampleCase(sourceCaseId)}
              className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left transition-colors hover:bg-surface-raised"
            >
              <PlaceholderImage src={item.image} alt={item.imageAlt} className="h-12 w-12 shrink-0 rounded-md" />
              <span className="line-clamp-2 text-sm text-secondary">{item.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  </Drawer>
);

const TemplateSection: React.FC<{
  title: string;
  items: string[];
}> = ({ title, items }) => (
  <section className="mt-5">
    <h3 className="text-sm font-semibold">{title}</h3>
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li key={item} className="rounded-lg bg-surface-raised p-3 text-sm leading-6 text-secondary">{item}</li>
      ))}
    </ul>
  </section>
);

const InfoLinks: React.FC<{
  sourceUrl: string | null;
  githubUrl: string | null;
}> = ({ sourceUrl, githubUrl }) => (
  <div className="mt-4 space-y-2">
    {sourceUrl && <ExternalLink href={sourceUrl} label={i18nService.t('creatorSourceUrl')} />}
    {githubUrl && <ExternalLink href={githubUrl} label={i18nService.t('creatorGithubUrl')} />}
  </div>
);

const ExternalLink: React.FC<{
  href: string;
  label: string;
}> = ({ href, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
  >
    {label}
    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
  </a>
);

const Drawer: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => (
  <div className="absolute inset-0 z-30 flex justify-end bg-black/30" onMouseDown={onClose}>
    <aside
      className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background shadow-xl"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
          aria-label={i18nService.t('close')}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </aside>
  </div>
);

export default CreatorStudioView;
