import { useCallback } from 'react';

import { i18nService } from '../../services/i18n';
import type { CreatorBuilderMaterial } from '../../types/creatorStudio';
import { CreatorMaterialSource } from '../../types/creatorStudio';
import { applyCreatorBriefAutofill } from '../../utils/creatorBriefAutofill';
import type { CreatorPromptForm, CreatorPromptSeed } from '../../utils/creatorStudio';

interface UseCreatorStartFlowInput {
  defaultBuilderForm: CreatorPromptForm;
  createMaterialFromFile: (file: File, source: CreatorMaterialSource) => Promise<CreatorBuilderMaterial>;
  getFileSystemPath: (file: File) => string | null;
  onError?: (message: string) => void;
  onOpenBuilder: () => void;
  onOpenImageTools: () => void;
  setBoardContextPack: (value: string) => void;
  setBuilderForm: (form: CreatorPromptForm) => void;
  setBuilderMaterials: (materials: CreatorBuilderMaterial[]) => void;
  setBuilderSeed: (seed: CreatorPromptSeed | null) => void;
  setImageToolsInitialFilePaths: (filePaths: string[]) => void;
}

export const useCreatorStartFlow = ({
  defaultBuilderForm,
  createMaterialFromFile,
  getFileSystemPath,
  onError,
  onOpenBuilder,
  onOpenImageTools,
  setBoardContextPack,
  setBuilderForm,
  setBuilderMaterials,
  setBuilderSeed,
  setImageToolsInitialFilePaths,
}: UseCreatorStartFlowInput) => {
  const dispatchError = useCallback((message: string) => {
    if (onError) {
      onError(message);
      return;
    }
    window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
  }, [onError]);

  const applyBriefToBuilder = useCallback((brief: string, materials: CreatorBuilderMaterial[]) => {
    const result = applyCreatorBriefAutofill(defaultBuilderForm, brief);
    setBuilderSeed(null);
    setBuilderForm(result.form);
    setBuilderMaterials(materials);
    setBoardContextPack('');
  }, [defaultBuilderForm, setBoardContextPack, setBuilderForm, setBuilderMaterials, setBuilderSeed]);

  const startFromBrief = useCallback((brief: string, materials: CreatorBuilderMaterial[] = []) => {
    applyBriefToBuilder(brief, materials);
    onOpenBuilder();
  }, [applyBriefToBuilder, onOpenBuilder]);

  const startFromLocalImages = useCallback(async (files: File[], brief: string) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0 && !brief.trim()) return;
    try {
      const materials = await Promise.all(imageFiles.map((file) => createMaterialFromFile(file, CreatorMaterialSource.File)));
      const filePaths = imageFiles.map(getFileSystemPath).filter((path): path is string => Boolean(path));
      if (filePaths.length > 0) {
        setImageToolsInitialFilePaths(filePaths);
        onOpenImageTools();
        if (brief.trim()) {
          applyBriefToBuilder(brief, materials);
        }
        return;
      }
      startFromBrief(brief, materials);
    } catch {
      dispatchError(i18nService.t('creatorStartMaterialImportFailed'));
    }
  }, [
    applyBriefToBuilder,
    createMaterialFromFile,
    dispatchError,
    getFileSystemPath,
    onOpenImageTools,
    setImageToolsInitialFilePaths,
    startFromBrief,
  ]);

  return {
    openStartImageTools: onOpenImageTools,
    startFromBrief,
    startFromLocalImages,
  };
};
