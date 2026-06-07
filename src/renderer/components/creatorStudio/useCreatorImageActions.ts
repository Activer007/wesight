import type {
  CreatorProductionAssetRecord,
  CreatorRecipeRecord,
} from '@shared/creatorStudio/types';
import { useCallback } from 'react';

import { creatorStudioAssetService } from '../../services/creatorStudioAssets';
import { i18nService } from '../../services/i18n';

interface UseCreatorImageActionsInput {
  currentProjectId: string;
  loadImageProcessingJobs: (projectId: string) => Promise<void>;
  loadProjectAssets: (projectId: string) => Promise<CreatorProductionAssetRecord[]>;
  onError?: (message: string) => void;
}

export const useCreatorImageActions = ({
  currentProjectId,
  loadImageProcessingJobs,
  loadProjectAssets,
  onError,
}: UseCreatorImageActionsInput) => {
  const dispatchMessage = useCallback((message: string) => {
    if (onError) {
      onError(message);
      return;
    }
    window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
  }, [onError]);

  const retryImageProcessingTask = useCallback(async (taskId: string) => {
    if (!currentProjectId) return;
    try {
      await creatorStudioAssetService.retryImageTask({ taskId });
      await Promise.all([
        loadImageProcessingJobs(currentProjectId),
        loadProjectAssets(currentProjectId),
      ]);
      dispatchMessage(i18nService.t('creatorImageBatchRetryDone'));
    } catch (error) {
      dispatchMessage(error instanceof Error ? error.message : i18nService.t('creatorImageBatchRetryFailed'));
    }
  }, [currentProjectId, dispatchMessage, loadImageProcessingJobs, loadProjectAssets]);

  const cancelImageProcessingTask = useCallback(async (taskId: string) => {
    if (!currentProjectId) return;
    try {
      await creatorStudioAssetService.cancelImageTask({ taskId });
      await loadImageProcessingJobs(currentProjectId);
      dispatchMessage(i18nService.t('creatorImageBatchCancelDone'));
    } catch (error) {
      dispatchMessage(error instanceof Error ? error.message : i18nService.t('creatorImageBatchCancelFailed'));
    }
  }, [currentProjectId, dispatchMessage, loadImageProcessingJobs]);

  const openImageProcessingReport = useCallback(async (jobId: string) => {
    try {
      await creatorStudioAssetService.openImageReport({ jobId });
    } catch (error) {
      dispatchMessage(error instanceof Error ? error.message : i18nService.t('creatorImageProcessingReportOpenFailed'));
    }
  }, [dispatchMessage]);

  const executeImageRecipe = useCallback(async (
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
      dispatchMessage(
        result.outputAssetIds.length > 0
          ? i18nService.t('creatorImageRecipeExecuted')
          : i18nService.t('creatorImageProcessingCompleted')
      );
    } catch (error) {
      dispatchMessage(error instanceof Error ? error.message : i18nService.t('creatorImageRecipeExecuteFailed'));
    }
  }, [dispatchMessage, loadImageProcessingJobs, loadProjectAssets]);

  return {
    cancelImageProcessingTask,
    executeImageRecipe,
    openImageProcessingReport,
    retryImageProcessingTask,
  };
};
