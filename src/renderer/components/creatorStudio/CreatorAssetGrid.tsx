import {
  AdjustmentsHorizontalIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  FolderOpenIcon,
  InformationCircleIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  CreatorAssetAdoptionStatus,
  type CreatorAssetAdoptionStatus as CreatorAssetAdoptionStatusType,
  CreatorImageMetadataStatus,
  CreatorImageProcessingOutputFormat,
  CreatorLocalImageImportMode,
  type CreatorLocalImageImportMode as CreatorLocalImageImportModeType,
  CreatorProductionAssetKind,
  CreatorProductionAssetSource,
  CreatorProductionAssetStatus,
  CreatorRecipeImageProcessingPackKind,
  CreatorRecipeOutputKind,
  CreatorStudioDefaultProjectId,
  CreatorStudioIpcChannel,
  isCreatorRecipeImageProcessingPackKind,
  isCreatorRecipeOutputKind,
  isCreatorRecipeOutputSchemaVersion,
} from '@shared/creatorStudio/constants';
import type { CreatorImageMetadata } from '@shared/creatorStudio/imageProcessingTypes';
import type {
  CreatorLocalImageImportResult,
  CreatorProductionAssetRecord,
  CreatorPromptVersionRecord,
  CreatorRecipeRecord,
  CreatorWorkspaceSnapshot,
} from '@shared/creatorStudio/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import casesData from '../../data/creatorStudio/cases.json';
import { creatorStudioAssetService } from '../../services/creatorStudioAssets';
import { i18nService } from '../../services/i18n';
import type { CreatorStudioCase } from '../../types/creatorStudio';
import { isCreatorImageProcessingEnabled } from '../../utils/creatorImageProcessingFeatureFlag';
import { ImagePostProcessingDrawer } from './ImagePostProcessingDrawer';

interface CreatorAssetGridProps {
  recipes?: CreatorRecipeRecord[];
  onOpenCoworkSession: (sessionId: string) => Promise<boolean>;
  onUseAssetAsReference: (asset: CreatorProductionAssetRecord) => void;
  onSendAssetToCowork: (asset: CreatorProductionAssetRecord) => void;
  onExecuteImageRecipe?: (asset: CreatorProductionAssetRecord, recipe: CreatorRecipeRecord) => Promise<void> | void;
}

const dispatchToast = (message: string) => {
  window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
};

const CreatorImageMetadataInspectConcurrency = 2;

const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text);
  dispatchToast(i18nService.t('copied'));
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

const PlaceholderImage: React.FC<{
  className?: string;
}> = ({ className = '' }) => (
  <div className={`flex items-center justify-center bg-surface-raised text-muted ${className}`}>
    <PhotoIcon className="h-10 w-10" />
  </div>
);

const PreviewImage: React.FC<{
  src: string | null;
  filePath?: string | null;
  alt: string;
  className?: string;
}> = ({ src, filePath, alt, className = '' }) => {
  const [activeSrc, setActiveSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const [triedDataUrlFallback, setTriedDataUrlFallback] = useState(false);

  useEffect(() => {
    setActiveSrc(src);
    setFailed(false);
    setTriedDataUrlFallback(false);
  }, [filePath, src]);

  const handleError = () => {
    if (filePath && !triedDataUrlFallback) {
      setTriedDataUrlFallback(true);
      void window.electron.dialog.readFileAsDataUrl(filePath)
        .then((result) => {
          if (result.success && result.dataUrl) {
            setActiveSrc(result.dataUrl);
            setFailed(false);
            return;
          }
          setFailed(true);
        })
        .catch(() => {
          setFailed(true);
        });
      return;
    }
    setFailed(true);
  };

  if (!activeSrc || failed) {
    return <PlaceholderImage className={className} />;
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      loading="lazy"
      onError={handleError}
      className={className}
    />
  );
};

const adoptionStatusOptions = [
  CreatorAssetAdoptionStatus.Unset,
  CreatorAssetAdoptionStatus.Favorite,
  CreatorAssetAdoptionStatus.Shortlisted,
  CreatorAssetAdoptionStatus.Adopted,
  CreatorAssetAdoptionStatus.Rejected,
] as const;

const getAdoptionStatusLabel = (status: CreatorAssetAdoptionStatusType): string => {
  switch (status) {
    case CreatorAssetAdoptionStatus.Favorite:
      return i18nService.t('creatorAssetStatusFavorite');
    case CreatorAssetAdoptionStatus.Shortlisted:
      return i18nService.t('creatorAssetStatusShortlisted');
    case CreatorAssetAdoptionStatus.Adopted:
      return i18nService.t('creatorAssetStatusAdopted');
    case CreatorAssetAdoptionStatus.Rejected:
      return i18nService.t('creatorAssetStatusRejected');
    case CreatorAssetAdoptionStatus.Unset:
    default:
      return i18nService.t('creatorAssetStatusUnset');
  }
};

const getProjectLabel = (projectId: string, name: string): string => (
  projectId === CreatorStudioDefaultProjectId ? i18nService.t('creatorDefaultProject') : name
);

const creatorCases = casesData as CreatorStudioCase[];
const creatorCaseMap = new Map<string, CreatorStudioCase>();
const creatorCaseTitleMap = new Map<string, CreatorStudioCase>();
for (const item of creatorCases) {
  creatorCaseMap.set(item.id, item);
  creatorCaseMap.set(`case-${item.sourceCaseId}`, item);
  creatorCaseTitleMap.set(item.title.trim().toLowerCase(), item);
}

const isFileBackedImage = (asset: CreatorProductionAssetRecord): boolean => (
  asset.kind === CreatorProductionAssetKind.Image
);

const isVirtualCreatorAssetPath = (filePath: string): boolean => (
  filePath.trim().startsWith('creator://')
);

const isRenderableImage = (asset: CreatorProductionAssetRecord): boolean => (
  isFileBackedImage(asset)
  && asset.status === CreatorProductionAssetStatus.Ready
  && !isVirtualCreatorAssetPath(asset.filePath)
);

const formatFileSize = (bytes: number | null | undefined): string => {
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

const getImageMetadataStatusLabel = (metadata: CreatorImageMetadata | null | undefined): string => {
  if (!metadata) return i18nService.t('creatorImageMetadataNotLoaded');
  switch (metadata.status) {
    case CreatorImageMetadataStatus.Ready:
      return i18nService.t('creatorImageMetadataReady');
    case CreatorImageMetadataStatus.Missing:
      return i18nService.t('creatorImageMetadataMissing');
    case CreatorImageMetadataStatus.Corrupt:
      return i18nService.t('creatorImageMetadataCorrupt');
    case CreatorImageMetadataStatus.Unsupported:
      return i18nService.t('creatorImageMetadataUnsupported');
    default:
      return i18nService.t('creatorImageUnknown');
  }
};

const formatImageDimensions = (metadata: CreatorImageMetadata | null | undefined): string => (
  metadata?.width && metadata.height
    ? `${metadata.width} x ${metadata.height}`
    : i18nService.t('creatorImageUnknown')
);

const formatImageType = (metadata: CreatorImageMetadata | null | undefined, fallbackMimeType?: string | null): string => {
  const format = metadata?.format?.toUpperCase();
  const mimeType = metadata?.mimeType || fallbackMimeType || null;
  if (format && mimeType) return `${format} / ${mimeType}`;
  return format || mimeType || i18nService.t('creatorImageUnknown');
};

const formatProcessingOperations = (asset: CreatorProductionAssetRecord): string => {
  const operations = asset.imageProcessing?.operations ?? [];
  if (!operations.length) return i18nService.t('creatorImageUnknown');
  return operations.map((item) => item.operation).join(', ');
};

const getAssetCasePreview = (asset: CreatorProductionAssetRecord): CreatorStudioCase | null => {
  for (const caseId of asset.caseIds) {
    const item = creatorCaseMap.get(caseId);
    if (item?.image) return item;
  }
  const promptSpec = asset.promptSpec && typeof asset.promptSpec === 'object' && !Array.isArray(asset.promptSpec)
    ? asset.promptSpec as Record<string, unknown>
    : null;
  const promptSpecSource = promptSpec?.source && typeof promptSpec.source === 'object' && !Array.isArray(promptSpec.source)
    ? promptSpec.source as Record<string, unknown>
    : null;
  const sourceId = typeof promptSpec?.sourceId === 'string'
    ? promptSpec.sourceId.trim()
    : typeof promptSpecSource?.sourceId === 'string'
      ? promptSpecSource.sourceId.trim()
      : '';
  if (sourceId) {
    const item = creatorCaseMap.get(sourceId);
    if (item?.image) return item;
  }
  const titleCandidates = [
    typeof promptSpec?.sourceTitle === 'string' ? promptSpec.sourceTitle : '',
    typeof promptSpecSource?.sourceTitle === 'string' ? promptSpecSource.sourceTitle : '',
    typeof promptSpec?.subject === 'string' ? promptSpec.subject : '',
    asset.fileName.replace(/\.prompt\.txt$/i, ''),
  ];
  for (const candidate of titleCandidates) {
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) continue;
    const item = creatorCaseTitleMap.get(normalized);
    if (item?.image) return item;
  }
  return null;
};

const getAssetPreview = (asset: CreatorProductionAssetRecord): {
  src: string | null;
  filePath: string | null;
  alt: string;
} => {
  if (isRenderableImage(asset)) {
    return {
      src: encodeLocalFileSrc(asset.filePath),
      filePath: asset.filePath,
      alt: asset.fileName,
    };
  }

  if (asset.kind === CreatorProductionAssetKind.Image && asset.imageSource?.thumbnailUrl) {
    return {
      src: asset.imageSource.thumbnailUrl,
      filePath: null,
      alt: asset.fileName,
    };
  }

  const casePreview = getAssetCasePreview(asset);
  if (casePreview?.image) {
    return {
      src: casePreview.image,
      filePath: null,
      alt: casePreview.imageAlt || casePreview.title,
    };
  }

  return {
    src: null,
    filePath: null,
    alt: asset.fileName,
  };
};

const AssetPreviewImage: React.FC<{
  asset: CreatorProductionAssetRecord;
  className?: string;
}> = ({ asset, className = '' }) => {
  const preview = getAssetPreview(asset);
  return (
    <PreviewImage
      src={preview.src}
      filePath={preview.filePath}
      alt={preview.alt}
      className={className}
    />
  );
};

const getAssetSourceLabel = (source: CreatorProductionAssetSource): string => {
  switch (source) {
    case CreatorProductionAssetSource.CreatorPrompt:
      return i18nService.t('creatorAssetSourcePrompt');
    case CreatorProductionAssetSource.CreatorCase:
      return i18nService.t('creatorAssetSourceCase');
    case CreatorProductionAssetSource.LocalImageImport:
      return i18nService.t('creatorAssetSourceLocalImageImport');
    case CreatorProductionAssetSource.CoworkGeneratedImage:
    default:
      return i18nService.t('creatorAssetSourceCowork');
  }
};

const getAssetCases = (asset: CreatorProductionAssetRecord): CreatorStudioCase[] => (
  asset.caseIds
    .map((caseId) => creatorCaseMap.get(caseId))
    .filter((item): item is CreatorStudioCase => Boolean(item))
);

const hasOpenableAssetSource = (asset: CreatorProductionAssetRecord): boolean => (
  asset.sourceSessionAvailable
  || Boolean(asset.variantOfAssetId)
  || Boolean(asset.imageProcessing?.sourceAssetId)
  || Boolean(getAssetCasePreview(asset))
);

const canPostProcessAsset = (asset: CreatorProductionAssetRecord): boolean => (
  asset.status === CreatorProductionAssetStatus.Ready
  && (
    asset.kind === CreatorProductionAssetKind.Image
    || Boolean(getAssetCasePreview(asset)?.image)
  )
);

const isMissingCreatorCaseImageHandlerError = (error: unknown): boolean => (
  error instanceof Error
  && error.message.includes('No handler registered')
  && error.message.includes(CreatorStudioIpcChannel.AssetCreateCaseImage)
);

const isReadmeBannerPackRecipe = (recipe: CreatorRecipeRecord): boolean => {
  const output = recipe.defaultOutput;
  if (!output || typeof output !== 'object' || Array.isArray(output)) return false;
  const record = output as Record<string, unknown>;
  const candidate = record.imageProcessing && typeof record.imageProcessing === 'object' && !Array.isArray(record.imageProcessing)
    ? record.imageProcessing as Record<string, unknown>
    : record;
  return isCreatorRecipeOutputSchemaVersion(candidate.schemaVersion)
    && isCreatorRecipeOutputKind(candidate.kind)
    && candidate.kind === CreatorRecipeOutputKind.ImageProcessing
    && isCreatorRecipeImageProcessingPackKind(candidate.packKind)
    && candidate.packKind === CreatorRecipeImageProcessingPackKind.ReadmeBannerPack
    && Array.isArray(candidate.rules)
    && candidate.rules.length > 0;
};

export const CreatorAssetGrid: React.FC<CreatorAssetGridProps> = ({
  recipes = [],
  onOpenCoworkSession,
  onUseAssetAsReference,
  onSendAssetToCowork,
  onExecuteImageRecipe,
}) => {
  const [workspace, setWorkspace] = useState<CreatorWorkspaceSnapshot | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [tag, setTag] = useState('');
  const [adoptionStatus, setAdoptionStatus] = useState('');
  const [source, setSource] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [assets, setAssets] = useState<CreatorProductionAssetRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<CreatorProductionAssetRecord | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [licenseNoteDraft, setLicenseNoteDraft] = useState('');
  const [usageNoteDraft, setUsageNoteDraft] = useState('');
  const [collectionTargetId, setCollectionTargetId] = useState('');
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptVersions, setPromptVersions] = useState<CreatorPromptVersionRecord[]>([]);
  const [promptVersionDiff, setPromptVersionDiff] = useState('');
  const [isLoadingPromptVersions, setIsLoadingPromptVersions] = useState(false);
  const [inspectingImageAssetIds, setInspectingImageAssetIds] = useState<Set<string>>(() => new Set());
  const [postProcessingAsset, setPostProcessingAsset] = useState<CreatorProductionAssetRecord | null>(null);
  const [executingRecipeAssetId, setExecutingRecipeAssetId] = useState<string | null>(null);
  const [batchImageAssetIds, setBatchImageAssetIds] = useState<Set<string>>(() => new Set());
  const [isCreatingImageBatch, setIsCreatingImageBatch] = useState(false);
  const [imageBatchMaxWidth, setImageBatchMaxWidth] = useState('1600');
  const [imageBatchMaxHeight, setImageBatchMaxHeight] = useState('1600');
  const [localImageImportMode, setLocalImageImportMode] = useState<CreatorLocalImageImportModeType>(CreatorLocalImageImportMode.Reference);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isImportingLocalImages, setIsImportingLocalImages] = useState(false);
  const imageProcessingEnabled = isCreatorImageProcessingEnabled();

  const currentCollections = useMemo(
    () => workspace?.collections.filter((collection) => collection.projectId === currentProjectId) ?? [],
    [currentProjectId, workspace?.collections]
  );

  const loadWorkspace = useCallback(async () => {
    const nextWorkspace = await creatorStudioAssetService.getWorkspace();
    setWorkspace(nextWorkspace);
    setCurrentProjectId((value) => value || nextWorkspace.currentProjectId);
  }, []);

  const loadAssets = useCallback(async () => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await creatorStudioAssetService.listAssets({
        projectId,
        ...(collectionId ? { collectionId } : {}),
        ...(templateId.trim() ? { templateId: templateId.trim() } : {}),
        ...(tag.trim() ? { tag: tag.trim() } : {}),
        ...(adoptionStatus ? { adoptionStatus: adoptionStatus as CreatorAssetAdoptionStatusType } : {}),
        ...(source ? { source: source as CreatorProductionAssetSource } : {}),
        ...(favoriteOnly ? { favorite: true } : {}),
        limit: 120,
      });
      setAssets(result.assets);
      setTotal(result.total);
      setSelectedAsset((asset) => {
        if (!asset) return null;
        return result.assets.find((item) => item.id === asset.id) ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : i18nService.t('creatorAssetsLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [adoptionStatus, collectionId, currentProjectId, favoriteOnly, source, tag, templateId, workspace?.currentProjectId]);

  const getLocalImageImportSummary = (result: CreatorLocalImageImportResult): string => {
    if (result.total === 0) {
      return i18nService.t('creatorLocalImageImportEmpty');
    }
    const summary = i18nService.t('creatorLocalImageImportDone')
      .replace('{imported}', String(result.imported))
      .replace('{reused}', String(result.reused))
      .replace('{skipped}', String(result.skipped));
    return result.failures.length > 0
      ? `${summary} ${i18nService.t('creatorLocalImageImportPartialFailed').replace('{count}', String(result.failures.length))}`
      : summary;
  };

  const handleImportLocalImages = async (kind: 'files' | 'folder') => {
    const projectId = currentProjectId || workspace?.currentProjectId;
    if (!projectId) {
      dispatchToast(i18nService.t('creatorWorkspaceLoadFailed'));
      return;
    }
    setIsImportingLocalImages(true);
    setIsImportMenuOpen(false);
    try {
      const input = {
        projectId,
        mode: localImageImportMode,
        ...(collectionId ? { collectionId } : {}),
      };
      const result = kind === 'files'
        ? await creatorStudioAssetService.importLocalImages(input)
        : await creatorStudioAssetService.importLocalImageFolder(input);
      dispatchToast(getLocalImageImportSummary(result));
      await loadAssets();
    } catch (importError) {
      dispatchToast(importError instanceof Error ? importError.message : i18nService.t('creatorLocalImageImportFailed'));
    } finally {
      setIsImportingLocalImages(false);
    }
  };

  useEffect(() => {
    void loadWorkspace().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : i18nService.t('creatorWorkspaceLoadFailed'));
    });
  }, [loadWorkspace]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const pendingAssets = assets.filter((asset) => (
      asset.kind === CreatorProductionAssetKind.Image
      && !asset.imageMetadata
      && !inspectingImageAssetIds.has(asset.id)
    )).slice(0, CreatorImageMetadataInspectConcurrency);
    if (pendingAssets.length === 0) return;

    let cancelled = false;
    setInspectingImageAssetIds((ids) => {
      const next = new Set(ids);
      for (const asset of pendingAssets) {
        next.add(asset.id);
      }
      return next;
    });

    for (const asset of pendingAssets) {
      void creatorStudioAssetService.inspectImage({ assetId: asset.id })
        .then((result) => {
          if (cancelled || !result) return;
          setAssets((items) => items.map((item) => item.id === result.asset.id ? result.asset : item));
          setSelectedAsset((selected) => selected?.id === result.asset.id ? result.asset : selected);
        })
        .catch(() => {
          if (cancelled) return;
          dispatchToast(i18nService.t('creatorImageMetadataInspectFailed'));
        })
        .finally(() => {
          if (cancelled) return;
          setInspectingImageAssetIds((ids) => {
            const next = new Set(ids);
            next.delete(asset.id);
            return next;
          });
        });
    }

    return () => {
      cancelled = true;
    };
  }, [assets, inspectingImageAssetIds]);

  useEffect(() => {
    if (!selectedAsset) {
      setTagDraft('');
      setLicenseNoteDraft('');
      setUsageNoteDraft('');
      setCollectionTargetId('');
      setPromptVersions([]);
      setPromptVersionDiff('');
      return;
    }
    setTagDraft(selectedAsset.tags.join(', '));
    setLicenseNoteDraft(selectedAsset.licenseNote ?? '');
    setUsageNoteDraft(selectedAsset.usageNote ?? '');
    setCollectionTargetId('');
    setPromptVersionDiff('');
  }, [selectedAsset]);

  useEffect(() => {
    if (!selectedAsset || selectedAsset.kind !== CreatorProductionAssetKind.Prompt) {
      setPromptVersions([]);
      return;
    }
    let cancelled = false;
    setIsLoadingPromptVersions(true);
    void creatorStudioAssetService.listPromptVersions({ promptAssetId: selectedAsset.id })
      .then((result) => {
        if (cancelled) return;
        setPromptVersions(result.versions);
      })
      .catch(() => {
        if (cancelled) return;
        dispatchToast(i18nService.t('creatorPromptVersionLoadFailed'));
        setPromptVersions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingPromptVersions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAsset]);

  const handleCreateProject = async () => {
    if (!projectNameDraft.trim()) return;
    setIsCreatingProject(true);
    try {
      const nextWorkspace = await creatorStudioAssetService.createProject({ name: projectNameDraft.trim() });
      setWorkspace(nextWorkspace);
      setCurrentProjectId(nextWorkspace.currentProjectId);
      setCollectionId('');
      setProjectNameDraft('');
      setIsProjectFormOpen(false);
    } catch (createError) {
      dispatchToast(createError instanceof Error ? createError.message : i18nService.t('creatorProjectCreateFailed'));
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    try {
      const nextWorkspace = await creatorStudioAssetService.setCurrentProject(projectId);
      setWorkspace(nextWorkspace);
      setCurrentProjectId(nextWorkspace.currentProjectId);
      setCollectionId('');
      setSelectedAsset(null);
    } catch (switchError) {
      dispatchToast(switchError instanceof Error ? switchError.message : i18nService.t('creatorProjectSwitchFailed'));
    }
  };

  const handleCreateCollection = async () => {
    if (!currentProjectId) return;
    const name = window.prompt(i18nService.t('creatorCollectionNamePrompt'));
    if (!name?.trim()) return;
    try {
      const nextWorkspace = await creatorStudioAssetService.createCollection({
        projectId: currentProjectId,
        name: name.trim(),
      });
      setWorkspace(nextWorkspace);
    } catch (createError) {
      dispatchToast(createError instanceof Error ? createError.message : i18nService.t('creatorCollectionCreateFailed'));
    }
  };

  const updateAssetInList = (updated: CreatorProductionAssetRecord | null) => {
    if (!updated) return;
    setAssets((items) => items.map((item) => item.id === updated.id ? updated : item));
    setSelectedAsset((asset) => asset?.id === updated.id ? updated : asset);
  };

  const handleCopyPrompt = async (asset: CreatorProductionAssetRecord) => {
    const prompt = asset.promptText.trim()
      || (asset.promptSpec ? JSON.stringify(asset.promptSpec, null, 2) : '');
    if (!prompt) {
      dispatchToast(i18nService.t('creatorAssetPromptMissing'));
      return;
    }
    await copyText(prompt);
  };

  const handleRevealAsset = async (asset: CreatorProductionAssetRecord) => {
    try {
      await creatorStudioAssetService.revealAssetInFolder(asset.id);
    } catch {
      dispatchToast(i18nService.t('creatorAssetFileUnavailable'));
    }
  };

  const ensureImagePostProcessingAsset = async (asset: CreatorProductionAssetRecord): Promise<CreatorProductionAssetRecord | null> => {
    if (asset.kind === CreatorProductionAssetKind.Image) {
      return asset.status === CreatorProductionAssetStatus.Ready ? asset : null;
    }
    const casePreview = getAssetCasePreview(asset);
    if (!casePreview?.image) return null;
    const projectId = currentProjectId || workspace?.currentProjectId || asset.projectId;
    const imageAsset = await creatorStudioAssetService.createCaseImageAsset({
      projectId,
      caseId: casePreview.id,
      title: casePreview.title,
      promptText: casePreview.prompt,
      imageThumbnailUrl: casePreview.imageThumbnailPath ?? casePreview.image,
      imageOriginalUrl: casePreview.imageOriginalUrl ?? null,
      mimeType: casePreview.imageOriginal?.mimeType ?? casePreview.imageThumbnail?.mimeType ?? null,
      width: casePreview.imageOriginal?.width ?? casePreview.imageThumbnail?.width ?? null,
      height: casePreview.imageOriginal?.height ?? casePreview.imageThumbnail?.height ?? null,
      byteSize: casePreview.imageOriginal?.byteSize ?? casePreview.imageThumbnail?.byteSize ?? null,
      sourceLabel: casePreview.sourceLabel,
      sourceUrl: casePreview.sourceUrl,
      githubUrl: casePreview.githubUrl,
      category: casePreview.category,
      styles: casePreview.styles,
      scenes: casePreview.scenes,
      tags: casePreview.tags,
    });
    if (imageAsset) {
      setAssets((items) => (
        items.some((item) => item.id === imageAsset.id) ? items : [imageAsset, ...items]
      ));
    }
    return imageAsset;
  };

  const handleOpenImagePostProcessing = async (asset: CreatorProductionAssetRecord) => {
    if (!canPostProcessAsset(asset)) return;
    try {
      const imageAsset = await ensureImagePostProcessingAsset(asset);
      if (!imageAsset) {
        dispatchToast(i18nService.t('creatorImageProcessingSourceMapFailed'));
        return;
      }
      setPostProcessingAsset(imageAsset);
    } catch (error) {
      dispatchToast(isMissingCreatorCaseImageHandlerError(error)
        ? i18nService.t('creatorImageProcessingRestartRequired')
        : error instanceof Error ? error.message : i18nService.t('creatorImageProcessingSourceMapFailed'));
    }
  };

  const handleOpenSource = async (asset: CreatorProductionAssetRecord) => {
    try {
      const sourceLookup = await creatorStudioAssetService.getAssetSource(asset.id);
      if (sourceLookup?.sourceAsset) {
        setSelectedAsset(sourceLookup.sourceAsset);
        return;
      }
      if (!sourceLookup?.session) {
        const casePreview = getAssetCasePreview(asset);
        const sourceUrl = casePreview?.githubUrl || casePreview?.sourceUrl || null;
        if (sourceUrl) {
          const opened = await window.electron.shell.openExternal(sourceUrl);
          if (opened.success) return;
        }
        dispatchToast(i18nService.t('creatorAssetSourceUnavailable'));
        await loadAssets();
        return;
      }
      const opened = await onOpenCoworkSession(sourceLookup.session.id);
      if (!opened) {
        dispatchToast(i18nService.t('creatorAssetSourceUnavailable'));
        await loadAssets();
      }
    } catch {
      dispatchToast(i18nService.t('creatorAssetSourceUnavailable'));
    }
  };

  const handleToggleFavorite = async (asset: CreatorProductionAssetRecord) => {
    try {
      updateAssetInList(await creatorStudioAssetService.setFavorite(asset.id, !asset.favorite));
    } catch {
      dispatchToast(i18nService.t('creatorAssetFavoriteFailed'));
    }
  };

  const handleToggleSelected = async (asset: CreatorProductionAssetRecord) => {
    try {
      updateAssetInList(await creatorStudioAssetService.updateAsset({
        assetId: asset.id,
        selected: !asset.selected,
      }));
    } catch {
      dispatchToast(i18nService.t('creatorAssetUpdateFailed'));
    }
  };

  const handleExecuteImageRecipe = async (
    asset: CreatorProductionAssetRecord,
    recipe: CreatorRecipeRecord,
  ) => {
    if (!onExecuteImageRecipe) return;
    setExecutingRecipeAssetId(asset.id);
    try {
      await onExecuteImageRecipe(asset, recipe);
      await loadAssets();
    } finally {
      setExecutingRecipeAssetId(null);
    }
  };

  const handleChangeAdoptionStatus = async (
    asset: CreatorProductionAssetRecord,
    nextStatus: CreatorAssetAdoptionStatusType
  ) => {
    try {
      updateAssetInList(await creatorStudioAssetService.updateAsset({
        assetId: asset.id,
        adoptionStatus: nextStatus,
        favorite: nextStatus === CreatorAssetAdoptionStatus.Favorite ? true : asset.favorite,
      }));
    } catch {
      dispatchToast(i18nService.t('creatorAssetUpdateFailed'));
    }
  };

  const handleSaveProvenance = async () => {
    if (!selectedAsset) return;
    try {
      const tags = tagDraft.split(',').map((item) => item.trim()).filter(Boolean);
      updateAssetInList(await creatorStudioAssetService.updateAsset({
        assetId: selectedAsset.id,
        tags,
        licenseNote: licenseNoteDraft,
        usageNote: usageNoteDraft,
      }));
      dispatchToast(i18nService.t('creatorAssetSaved'));
    } catch {
      dispatchToast(i18nService.t('creatorAssetUpdateFailed'));
    }
  };

  const handleAddToCollection = async () => {
    if (!selectedAsset || !collectionTargetId) return;
    try {
      updateAssetInList(await creatorStudioAssetService.addAssetToCollection({
        assetId: selectedAsset.id,
        collectionId: collectionTargetId,
      }));
      await loadWorkspace();
      await loadAssets();
      dispatchToast(i18nService.t('creatorAssetAddedToCollection'));
    } catch {
      dispatchToast(i18nService.t('creatorAssetUpdateFailed'));
    }
  };

  const handleDiffPromptVersion = async (
    version: CreatorPromptVersionRecord,
    previousVersion: CreatorPromptVersionRecord | undefined
  ) => {
    if (!previousVersion) {
      dispatchToast(i18nService.t('creatorPromptVersionDiffUnavailable'));
      return;
    }
    try {
      const diff = await creatorStudioAssetService.diffPromptVersions({
        fromVersionId: previousVersion.id,
        toVersionId: version.id,
      });
      setPromptVersionDiff([
        `${i18nService.t('creatorPromptVersionDiff')}: v${previousVersion.version} -> v${version.version}`,
        '',
        `promptTextChanged: ${diff.promptTextChanged}`,
        `promptSpecChanged: ${diff.promptSpecChanged}`,
        '',
        'Prompt before:',
        diff.promptTextBefore,
        '',
        'Prompt after:',
        diff.promptTextAfter,
      ].join('\n'));
    } catch {
      dispatchToast(i18nService.t('creatorPromptVersionDiffFailed'));
    }
  };

  const handleRollbackPromptVersion = async (version: CreatorPromptVersionRecord) => {
    if (!selectedAsset) return;
    try {
      const title = `${selectedAsset.fileName.replace(/\.prompt\.txt$/i, '')} rollback v${version.version}`;
      const forked = await creatorStudioAssetService.forkPromptVersion({
        promptVersionId: version.id,
        projectId: selectedAsset.projectId,
        title,
        changeNote: `Rollback fork from v${version.version}`,
      });
      await loadAssets();
      setSelectedAsset(forked);
      dispatchToast(i18nService.t('creatorPromptVersionRollbackCreated'));
    } catch {
      dispatchToast(i18nService.t('creatorPromptVersionRollbackFailed'));
    }
  };

  const handleClearFilters = () => {
    setCollectionId('');
    setTemplateId('');
    setTag('');
    setAdoptionStatus('');
    setSource('');
    setFavoriteOnly(false);
  };

  const handleImageProcessingCompleted = (outputAssets: CreatorProductionAssetRecord[]) => {
    void loadAssets();
    if (outputAssets[0]) {
      setSelectedAsset(outputAssets[0]);
    }
  };

  const selectedAssetCases = useMemo(
    () => selectedAsset ? getAssetCases(selectedAsset) : [],
    [selectedAsset]
  );
  const readmeBannerRecipe = useMemo(
    () => recipes.find(isReadmeBannerPackRecipe) ?? null,
    [recipes]
  );
  const selectedAssetCanReveal = Boolean(selectedAsset && isFileBackedImage(selectedAsset));
  const selectedBatchImageAssetIds = useMemo(
    () => assets
      .filter((asset) => (
        batchImageAssetIds.has(asset.id)
        && asset.kind === CreatorProductionAssetKind.Image
        && asset.status === CreatorProductionAssetStatus.Ready
      ))
      .map((asset) => asset.id),
    [assets, batchImageAssetIds]
  );

  const toggleBatchImageAsset = (asset: CreatorProductionAssetRecord) => {
    if (asset.kind !== CreatorProductionAssetKind.Image || asset.status !== CreatorProductionAssetStatus.Ready) return;
    setBatchImageAssetIds((ids) => {
      const next = new Set(ids);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        next.add(asset.id);
      }
      return next;
    });
  };

  const createImageBatch = async (mode: 'webp' | 'compress' | 'resize') => {
    if (!currentProjectId || selectedBatchImageAssetIds.length === 0) return;
    const maxWidth = Number(imageBatchMaxWidth);
    const maxHeight = Number(imageBatchMaxHeight);
    setIsCreatingImageBatch(true);
    try {
      await creatorStudioAssetService.createImageBatch({
        projectId: currentProjectId,
        assetIds: selectedBatchImageAssetIds,
        waitForCompletion: false,
        outputFormat: CreatorImageProcessingOutputFormat.Webp,
        quality: mode === 'compress' ? 72 : 82,
        ...(mode === 'resize' && Number.isFinite(maxWidth) && maxWidth > 0 ? { maxWidth } : {}),
        ...(mode === 'resize' && Number.isFinite(maxHeight) && maxHeight > 0 ? { maxHeight } : {}),
      });
      setBatchImageAssetIds(new Set());
      await loadAssets();
      dispatchToast(i18nService.t('creatorImageBatchCreated'));
    } catch (batchError) {
      dispatchToast(batchError instanceof Error ? batchError.message : i18nService.t('creatorImageBatchCreateFailed'));
    } finally {
      setIsCreatingImageBatch(false);
    }
  };

  return (
    <section className="grid min-h-full gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{i18nService.t('creatorWorkspaceTitle')}</h2>
              <p className="mt-1 text-xs text-muted">
                {i18nService.t('creatorAssetsCount').replace('{count}', String(total))}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={imageBatchMaxWidth}
                onChange={(event) => setImageBatchMaxWidth(event.target.value)}
                inputMode="numeric"
                aria-label={i18nService.t('creatorImageBatchMaxWidth')}
                placeholder={i18nService.t('creatorImageBatchMaxWidth')}
                className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              />
              <input
                value={imageBatchMaxHeight}
                onChange={(event) => setImageBatchMaxHeight(event.target.value)}
                inputMode="numeric"
                aria-label={i18nService.t('creatorImageBatchMaxHeight')}
                placeholder={i18nService.t('creatorImageBatchMaxHeight')}
                className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              />
              <select
                value={localImageImportMode}
                onChange={(event) => setLocalImageImportMode(event.target.value as CreatorLocalImageImportModeType)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                aria-label={i18nService.t('creatorLocalImageImportMode')}
              >
                <option value={CreatorLocalImageImportMode.Reference}>{i18nService.t('creatorLocalImageImportModeReference')}</option>
                <option value={CreatorLocalImageImportMode.Copy}>{i18nService.t('creatorLocalImageImportModeCopy')}</option>
              </select>
              <div className="relative">
                <button
                  type="button"
                  disabled={isImportingLocalImages}
                  onClick={() => setIsImportMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PhotoIcon className="h-4 w-4" />
                  {isImportingLocalImages ? i18nService.t('creatorLocalImageImporting') : i18nService.t('creatorLocalImageImport')}
                </button>
                {isImportMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                    <button
                      type="button"
                      onClick={() => void handleImportLocalImages('files')}
                      className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-surface-raised hover:text-foreground"
                    >
                      {i18nService.t('creatorLocalImageImportFiles')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleImportLocalImages('folder')}
                      className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-surface-raised hover:text-foreground"
                    >
                      {i18nService.t('creatorLocalImageImportFolder')}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsProjectFormOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <PlusIcon className="h-4 w-4" />
                {i18nService.t('creatorProjectCreate')}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateCollection()}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <PlusIcon className="h-4 w-4" />
                {i18nService.t('creatorCollectionCreate')}
              </button>
              <button
                type="button"
                onClick={() => void loadAssets()}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                {isLoading ? i18nService.t('loading') : i18nService.t('creatorAssetsRefresh')}
              </button>
            </div>
          </div>
          {isProjectFormOpen && (
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={projectNameDraft}
                onChange={(event) => setProjectNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreateProject();
                  if (event.key === 'Escape') setIsProjectFormOpen(false);
                }}
                autoFocus
                placeholder={i18nService.t('projectNamePlaceholder')}
                className="h-10 min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!projectNameDraft.trim() || isCreatingProject}
                onClick={() => void handleCreateProject()}
                className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {i18nService.t('create')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProjectNameDraft('');
                  setIsProjectFormOpen(false);
                }}
                className="h-10 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                {i18nService.t('cancel')}
              </button>
            </div>
          )}

          <div className="mt-4 grid gap-2 lg:grid-cols-[180px_170px_160px_1fr_1fr_150px_auto]">
            <select
              value={currentProjectId}
              onChange={(event) => void handleSwitchProject(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              aria-label={i18nService.t('creatorProjectSelect')}
            >
              {workspace?.projects.map((project) => (
                <option key={project.id} value={project.id}>{getProjectLabel(project.id, project.name)}</option>
              ))}
            </select>
            <select
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              aria-label={i18nService.t('creatorCollectionFilter')}
            >
              <option value="">{i18nService.t('creatorCollectionAll')}</option>
              {currentCollections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name} ({collection.assetCount})
                </option>
              ))}
            </select>
            <select
              value={adoptionStatus}
              onChange={(event) => setAdoptionStatus(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              aria-label={i18nService.t('creatorAssetStatusFilter')}
            >
              <option value="">{i18nService.t('creatorAssetStatusAll')}</option>
              {adoptionStatusOptions.map((status) => (
                <option key={status} value={status}>{getAdoptionStatusLabel(status)}</option>
              ))}
            </select>
            <input
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              placeholder={i18nService.t('creatorTemplateFilterPlaceholder')}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder={i18nService.t('creatorTagFilterPlaceholder')}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              aria-label={i18nService.t('creatorAssetSourceFilter')}
            >
              <option value="">{i18nService.t('creatorAssetSourceAll')}</option>
              <option value={CreatorProductionAssetSource.CoworkGeneratedImage}>
                {i18nService.t('creatorAssetSourceCowork')}
              </option>
              <option value={CreatorProductionAssetSource.CreatorPrompt}>
                {i18nService.t('creatorAssetSourcePrompt')}
              </option>
              <option value={CreatorProductionAssetSource.CreatorCase}>
                {i18nService.t('creatorAssetSourceCase')}
              </option>
              <option value={CreatorProductionAssetSource.LocalImageImport}>
                {i18nService.t('creatorAssetSourceLocalImageImport')}
              </option>
            </select>
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-10 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {i18nService.t('creatorClearFilters')}
            </button>
          </div>

          <label className="mt-3 inline-flex items-center gap-2 text-xs text-secondary">
            <input
              type="checkbox"
              checked={favoriteOnly}
              onChange={(event) => setFavoriteOnly(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {i18nService.t('creatorFavoriteOnly')}
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {imageProcessingEnabled && selectedBatchImageAssetIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div>
              <div className="text-sm font-semibold text-primary">
                {i18nService.t('creatorImageBatchSelected').replace('{count}', String(selectedBatchImageAssetIds.length))}
              </div>
              <div className="mt-1 text-xs text-muted">{i18nService.t('creatorImageBatchToolbarHint')}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isCreatingImageBatch}
                onClick={() => void createImageBatch('webp')}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {i18nService.t('creatorImageBatchWebp')}
              </button>
              <button
                type="button"
                disabled={isCreatingImageBatch}
                onClick={() => void createImageBatch('compress')}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {i18nService.t('creatorImageBatchCompress')}
              </button>
              <button
                type="button"
                disabled={isCreatingImageBatch}
                onClick={() => void createImageBatch('resize')}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {i18nService.t('creatorImageBatchResize')}
              </button>
              <button
                type="button"
                disabled={isCreatingImageBatch}
                onClick={() => setBatchImageAssetIds(new Set())}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {i18nService.t('cancel')}
              </button>
            </div>
          </div>
        )}

        {!isLoading && assets.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface text-center">
            <PhotoIcon className="h-10 w-10 text-muted" />
            <div className="mt-3 text-sm font-medium">{i18nService.t('creatorAssetsEmptyTitle')}</div>
            <div className="mt-1 max-w-md text-xs leading-5 text-muted">{i18nService.t('creatorAssetsEmptyHint')}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {assets.map((asset) => (
              <article key={asset.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                <div className="relative aspect-[4/3] bg-surface-raised">
                  <AssetPreviewImage asset={asset} className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => void handleToggleSelected(asset)}
                    className={`absolute left-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/90 transition-colors hover:bg-surface ${
                      asset.selected ? 'text-primary' : 'text-muted'
                    }`}
                    aria-label={asset.selected ? i18nService.t('creatorAssetUnselect') : i18nService.t('creatorAssetSelect')}
                    title={asset.selected ? i18nService.t('creatorAssetUnselect') : i18nService.t('creatorAssetSelect')}
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleFavorite(asset)}
                    className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/90 transition-colors hover:bg-surface ${
                      asset.favorite ? 'text-amber-500' : 'text-muted'
                    }`}
                    aria-label={i18nService.t('creatorAssetFavorite')}
                  >
                    <StarIcon className="h-4 w-4" />
                  </button>
                  {imageProcessingEnabled && asset.kind === CreatorProductionAssetKind.Image && asset.status === CreatorProductionAssetStatus.Ready && (
                    <label className="absolute bottom-2 left-2 inline-flex items-center gap-2 rounded-lg border border-border bg-background/90 px-2 py-1 text-[11px] font-medium text-secondary">
                      <input
                        type="checkbox"
                        checked={batchImageAssetIds.has(asset.id)}
                        onChange={() => toggleBatchImageAsset(asset)}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                      {i18nService.t('creatorImageBatchSelect')}
                    </label>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <h3 className="truncate text-sm font-semibold">{asset.fileName}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[11px] text-secondary">
                      {getAdoptionStatusLabel(asset.adoptionStatus)}
                    </span>
                    <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[11px] text-secondary">
                      {getAssetSourceLabel(asset.source)}
                    </span>
                    {asset.selected && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {i18nService.t('creatorAssetSelected')}
                      </span>
                    )}
                    {asset.templateId && (
                      <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[11px] text-secondary">
                        {asset.templateId}
                      </span>
                    )}
                    {asset.tags.slice(0, 3).map((assetTag) => (
                      <span key={assetTag} className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-[11px] text-secondary">
                        <TagIcon className="h-3 w-3" />
                        {assetTag}
                      </span>
                    ))}
                  </div>
                  {asset.kind === CreatorProductionAssetKind.Image && (
                    <div className="rounded-lg bg-surface-raised px-2 py-1.5 text-[11px] leading-5 text-secondary">
                      <div>{formatImageDimensions(asset.imageMetadata)}</div>
                      <div className="truncate">{formatImageType(asset.imageMetadata, asset.mimeType)}</div>
                      <div className="flex flex-wrap gap-x-2">
                        <span>{formatFileSize(asset.imageMetadata?.fileSize)}</span>
                        <span>{getImageMetadataStatusLabel(asset.imageMetadata)}</span>
                      </div>
                    </div>
                  )}
                  <select
                    value={asset.adoptionStatus}
                    onChange={(event) => void handleChangeAdoptionStatus(asset, event.target.value as CreatorAssetAdoptionStatusType)}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                    aria-label={i18nService.t('creatorAssetStatus')}
                  >
                    {adoptionStatusOptions.map((status) => (
                      <option key={status} value={status}>{getAdoptionStatusLabel(status)}</option>
                    ))}
                  </select>
                  <div className="text-xs text-muted">{new Date(asset.createdAt).toLocaleString()}</div>
                  {!hasOpenableAssetSource(asset) && (
                    <div className="text-xs text-muted">{i18nService.t('creatorAssetSourceMissing')}</div>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-1 border-t border-border p-2">
                  <IconAction label={i18nService.t('creatorAssetUseAsReference')} onClick={() => onUseAssetAsReference(asset)}>
                    <SparklesIcon className="h-4 w-4" />
                  </IconAction>
                  <IconAction label={i18nService.t('creatorAssetSendToCowork')} onClick={() => onSendAssetToCowork(asset)}>
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </IconAction>
                  <IconAction label={i18nService.t('copy')} onClick={() => void handleCopyPrompt(asset)}>
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </IconAction>
                  <IconAction label={i18nService.t('creatorAssetSource')} onClick={() => void handleOpenSource(asset)} disabled={!hasOpenableAssetSource(asset)}>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </IconAction>
                  <IconAction label={i18nService.t('creatorAssetDetails')} onClick={() => setSelectedAsset(asset)}>
                    <InformationCircleIcon className="h-4 w-4" />
                  </IconAction>
                  {imageProcessingEnabled && (
                    <IconAction
                      label={i18nService.t('creatorImagePostProcessingAction')}
                      onClick={() => void handleOpenImagePostProcessing(asset)}
                      disabled={!canPostProcessAsset(asset)}
                    >
                      <AdjustmentsHorizontalIcon className="h-4 w-4" />
                    </IconAction>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <aside className="min-h-0 rounded-lg border border-border bg-surface">
        {selectedAsset ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{i18nService.t('creatorAssetProvenance')}</h2>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                aria-label={i18nService.t('close')}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <AssetPreviewImage asset={selectedAsset} className="aspect-[4/3] w-full rounded-lg bg-surface-raised object-contain" />
              <ProvenanceRow label={i18nService.t('creatorAssetFileName')} value={selectedAsset.fileName} />
              {selectedAsset.kind === CreatorProductionAssetKind.Image && (
                <section className="rounded-lg border border-border p-3">
                  <h3 className="text-xs font-medium text-secondary">{i18nService.t('creatorImageMetadata')}</h3>
                  <div className="mt-2 space-y-2">
                    <ProvenanceRow label={i18nService.t('creatorImageDimensions')} value={formatImageDimensions(selectedAsset.imageMetadata)} />
                    <ProvenanceRow label={i18nService.t('creatorImageFormat')} value={selectedAsset.imageMetadata?.format?.toUpperCase() || i18nService.t('creatorImageUnknown')} />
                    <ProvenanceRow label={i18nService.t('creatorImageMimeType')} value={selectedAsset.imageMetadata?.mimeType || selectedAsset.mimeType || i18nService.t('creatorImageUnknown')} />
                    <ProvenanceRow label={i18nService.t('creatorImageFileSize')} value={formatFileSize(selectedAsset.imageMetadata?.fileSize)} />
                    <ProvenanceRow label={i18nService.t('creatorImageAlpha')} value={selectedAsset.imageMetadata?.hasAlpha === null || selectedAsset.imageMetadata?.hasAlpha === undefined ? i18nService.t('creatorImageUnknown') : selectedAsset.imageMetadata.hasAlpha ? i18nService.t('creatorImageAlphaPresent') : i18nService.t('creatorImageAlphaAbsent')} />
                    <ProvenanceRow label={i18nService.t('creatorImageOrientation')} value={selectedAsset.imageMetadata?.exifOrientation ? String(selectedAsset.imageMetadata.exifOrientation) : i18nService.t('creatorImageUnknown')} />
                    <ProvenanceRow label={i18nService.t('creatorImageColorSpace')} value={selectedAsset.imageMetadata?.colorSpace || i18nService.t('creatorImageUnknown')} />
                    <ProvenanceRow label={i18nService.t('creatorImageMetadataStatus')} value={getImageMetadataStatusLabel(selectedAsset.imageMetadata)} />
                    {selectedAsset.imageMetadata?.warningCodes.length ? (
                      <ProvenanceRow label={i18nService.t('creatorImageWarnings')} value={selectedAsset.imageMetadata.warningCodes.join(', ')} />
                    ) : null}
                  </div>
                </section>
              )}
              {selectedAsset.kind === CreatorProductionAssetKind.Image && selectedAsset.imageProcessing && (
                <section className="rounded-lg border border-border p-3">
                  <h3 className="text-xs font-medium text-secondary">{i18nService.t('creatorImageProcessingDetails')}</h3>
                  <div className="mt-2 space-y-2">
                    <ProvenanceRow label={i18nService.t('creatorImageProcessingSourceAsset')} value={selectedAsset.imageProcessing.sourceAssetId} />
                    <ProvenanceRow label={i18nService.t('creatorImageProcessingPlanId')} value={selectedAsset.imageProcessing.plan?.id || 'none'} />
                    <ProvenanceRow label={i18nService.t('creatorImageProcessingPreset')} value={selectedAsset.imageProcessing.presetId || i18nService.t('creatorImageProcessingPresetCustom')} />
                    <ProvenanceRow label={i18nService.t('creatorImageProcessingOutputFormat')} value={selectedAsset.imageProcessing.plan?.output.format?.toUpperCase() || selectedAsset.imageMetadata?.format?.toUpperCase() || i18nService.t('creatorImageUnknown')} />
                    <ProvenanceRow label={i18nService.t('creatorImageProcessingQuality')} value={selectedAsset.imageProcessing.plan?.output.quality === null || selectedAsset.imageProcessing.plan?.output.quality === undefined ? i18nService.t('creatorImageUnknown') : String(selectedAsset.imageProcessing.plan.output.quality)} />
                    <ProvenanceRow label={i18nService.t('creatorImageProcessingOperations')} value={formatProcessingOperations(selectedAsset)} />
                    <ProvenanceRow label={i18nService.t('creatorImageProcessingJobStatus')} value={selectedAsset.imageProcessing.job?.status || 'none'} />
                    <ProvenanceRow label={i18nService.t('creatorImageProcessingTaskStatus')} value={selectedAsset.imageProcessing.task?.status || 'none'} />
                  </div>
                </section>
              )}
              <ProvenanceRow label={i18nService.t('creatorAssetLocalPath')} value={selectedAsset.filePath} />
              <ProvenanceRow label={i18nService.t('creatorAssetSource')} value={getAssetSourceLabel(selectedAsset.source)} />
              <ProvenanceRow label="templateId" value={selectedAsset.templateId || 'none'} />
              <ProvenanceRow label="caseIds" value={selectedAsset.caseIds.length > 0 ? selectedAsset.caseIds.join(', ') : 'none'} />
              <ProvenanceRow label="sessionId" value={selectedAsset.sessionId || 'none'} />
              <ProvenanceRow label="messageId" value={selectedAsset.messageId || 'none'} />
              <ProvenanceRow label="variantOfAssetId" value={selectedAsset.variantOfAssetId || 'none'} />
              <ProvenanceRow label="parentPromptAssetId" value={selectedAsset.parentPromptAssetId || 'none'} />
              <ProvenanceRow label="promptVersionId" value={selectedAsset.promptVersionId || 'none'} />
              <ProvenanceRow label="recipeId" value={selectedAsset.recipeId || 'none'} />
              <ProvenanceRow label="selectedDirectionId" value={selectedAsset.selectedDirectionId || 'none'} />
              <button
                type="button"
                onClick={() => void handleToggleSelected(selectedAsset)}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedAsset.selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-secondary hover:bg-surface-raised hover:text-foreground'
                }`}
              >
                <CheckCircleIcon className="h-4 w-4" />
                {selectedAsset.selected ? i18nService.t('creatorAssetUnselect') : i18nService.t('creatorAssetSelect')}
              </button>

              {selectedAsset.kind === CreatorProductionAssetKind.Prompt && (
                <section className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-medium text-secondary">{i18nService.t('creatorPromptVersionHistory')}</h3>
                    <span className="text-[11px] text-muted">{promptVersions.length}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {isLoadingPromptVersions ? (
                      <div className="text-xs text-muted">{i18nService.t('loading')}</div>
                    ) : promptVersions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-surface-raised p-3 text-xs text-muted">
                        {i18nService.t('creatorPromptVersionEmpty')}
                      </div>
                    ) : promptVersions.map((version, index) => (
                      <div key={version.id} className="rounded-lg bg-surface-raised p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold">v{version.version}</div>
                            <div className="mt-1 text-[11px] text-muted">{new Date(version.createdAt).toLocaleString()}</div>
                            {version.changeNote && <div className="mt-1 break-words text-[11px] text-secondary">{version.changeNote}</div>}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => void handleDiffPromptVersion(version, promptVersions[index + 1])}
                              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-background hover:text-foreground"
                            >
                              {i18nService.t('creatorPromptVersionDiff')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRollbackPromptVersion(version)}
                              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-background hover:text-foreground"
                            >
                              {i18nService.t('creatorPromptVersionRollback')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {promptVersionDiff && (
                    <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-[11px] leading-5 text-secondary">
                      {promptVersionDiff}
                    </pre>
                  )}
                </section>
              )}

              {selectedAssetCases.length > 0 && (
                <section className="rounded-lg border border-border p-3">
                  <h3 className="text-xs font-medium text-secondary">{i18nService.t('creatorAssetSourceCases')}</h3>
                  <div className="mt-2 space-y-3">
                    {selectedAssetCases.map((item) => (
                      <div key={item.id} className="rounded-lg bg-surface-raised p-3">
                        <div className="text-xs font-semibold text-foreground">{item.title}</div>
                        <div className="mt-1 text-[11px] text-muted">{item.sourceLabel || i18nService.t('creatorUnknownSource')}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.sourceUrl && <ExternalCaseLink href={item.sourceUrl} label={i18nService.t('creatorSourceUrl')} />}
                          {item.githubUrl && <ExternalCaseLink href={item.githubUrl} label={i18nService.t('creatorGithubUrl')} />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-muted">{i18nService.t('creatorDisclaimer')}</p>
                </section>
              )}

              <label className="block">
                <span className="text-xs font-medium text-secondary">{i18nService.t('creatorAssetTags')}</span>
                <input
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-secondary">{i18nService.t('creatorAssetLicenseNote')}</span>
                <textarea
                  value={licenseNoteDraft}
                  onChange={(event) => setLicenseNoteDraft(event.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-secondary">{i18nService.t('creatorAssetUsageNote')}</span>
                <textarea
                  value={usageNoteDraft}
                  onChange={(event) => setUsageNoteDraft(event.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleSaveProvenance()}
                className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                {i18nService.t('creatorAssetSaveMetadata')}
              </button>

              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-medium text-secondary">{i18nService.t('creatorCollectionAddAsset')}</div>
                <div className="mt-2 flex gap-2">
                  <select
                    value={collectionTargetId}
                    onChange={(event) => setCollectionTargetId(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                  >
                    <option value="">{i18nService.t('creatorCollectionSelect')}</option>
                    {currentCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>{collection.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!collectionTargetId}
                    onClick={() => void handleAddToCollection()}
                    className="rounded-lg border border-border px-3 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {i18nService.t('add')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onUseAssetAsReference(selectedAsset)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground">
                  {i18nService.t('creatorAssetUseAsReference')}
                </button>
                <button type="button" onClick={() => onSendAssetToCowork(selectedAsset)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground">
                  {i18nService.t('creatorAssetSendToCowork')}
                </button>
                <button type="button" onClick={() => void handleOpenSource(selectedAsset)} disabled={!hasOpenableAssetSource(selectedAsset)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                  {i18nService.t('creatorAssetSource')}
                </button>
                <button type="button" onClick={() => void handleRevealAsset(selectedAsset)} disabled={!selectedAssetCanReveal} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                  <FolderOpenIcon className="h-4 w-4" />
                  {i18nService.t('creatorAssetReveal')}
                </button>
                {imageProcessingEnabled && canPostProcessAsset(selectedAsset) && (
                  <button
                    type="button"
                    onClick={() => void handleOpenImagePostProcessing(selectedAsset)}
                    disabled={!canPostProcessAsset(selectedAsset)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <AdjustmentsHorizontalIcon className="h-4 w-4" />
                    {i18nService.t('creatorImagePostProcessingAction')}
                  </button>
                )}
                {imageProcessingEnabled && selectedAsset.kind === CreatorProductionAssetKind.Image && readmeBannerRecipe && (
                  <button
                    type="button"
                    onClick={() => void handleExecuteImageRecipe(selectedAsset, readmeBannerRecipe)}
                    disabled={
                      selectedAsset.status !== CreatorProductionAssetStatus.Ready
                      || executingRecipeAssetId === selectedAsset.id
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <SparklesIcon className="h-4 w-4" />
                    {executingRecipeAssetId === selectedAsset.id
                      ? i18nService.t('creatorImageRecipeExecuting')
                      : i18nService.t('creatorImageRecipeReadmeBanner')}
                  </button>
                )}
              </div>

              <section>
                <h3 className="text-xs font-medium text-secondary">{i18nService.t('creatorPromptPreview')}</h3>
                <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-raised p-3 text-xs leading-5 text-secondary">
                  {selectedAsset.promptText || JSON.stringify(selectedAsset.promptSpec, null, 2)}
                </pre>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center p-6 text-center">
            <InformationCircleIcon className="h-10 w-10 text-muted" />
            <div className="mt-3 text-sm font-medium">{i18nService.t('creatorAssetProvenanceEmptyTitle')}</div>
            <div className="mt-1 text-xs leading-5 text-muted">{i18nService.t('creatorAssetProvenanceEmptyHint')}</div>
          </div>
        )}
      </aside>
      <ImagePostProcessingDrawer
        asset={postProcessingAsset}
        onClose={() => setPostProcessingAsset(null)}
        onCompleted={handleImageProcessingCompleted}
      />
    </section>
  );
};

const IconAction: React.FC<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, disabled = false, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    title={label}
    className="inline-flex items-center justify-center rounded-lg px-2 py-2 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
    <span className="sr-only">{label}</span>
  </button>
);

const ExternalCaseLink: React.FC<{
  href: string;
  label: string;
}> = ({ href, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
  >
    {label}
    <ArrowTopRightOnSquareIcon className="h-3 w-3" />
  </a>
);

const ProvenanceRow: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div>
    <div className="text-[11px] font-medium uppercase text-muted">{label}</div>
    <div className="mt-1 break-words rounded-lg bg-surface-raised p-2 text-xs leading-5 text-secondary">{value}</div>
  </div>
);
