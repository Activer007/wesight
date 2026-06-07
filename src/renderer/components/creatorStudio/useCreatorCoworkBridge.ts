import { CreatorBatchTaskStatus, CreatorCoworkAction } from '@shared/creatorStudio/constants';
import type {
  CreatorBatchRunRecord,
  CreatorBatchTaskRecord,
  CreatorProductionAssetRecord,
  CreatorPromptSpecSnapshot,
  CreatorStudioMessageMetadata,
} from '@shared/creatorStudio/types';
import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';

import { i18nService } from '../../services/i18n';
import { setActiveSkillIds } from '../../store/slices/skillSlice';
import type { CreatorBuilderMaterial, CreatorPromptSpec } from '../../types/creatorStudio';
import { compileCreatorPrompt, CreatorPromptCompileTarget } from '../../utils/creatorPromptCompiler';

export interface CreatorCoworkSendOptions {
  activeSkillIds: string[];
  preferCreativeProducer?: boolean;
  attachments?: CreatorCoworkDraftAttachment[];
  messageMetadata?: Record<string, unknown>;
}

export interface CreatorCoworkDraftAttachment {
  path: string;
  name: string;
  isImage?: boolean;
  dataUrl?: string;
}

export const buildCreatorCoworkMessageMetadata = ({
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

interface UseCreatorCoworkBridgeInput {
  installedRecommendedSkillIds: string[];
  missingRecommendedSkillIds: string[];
  onSendToCowork: (draft: string, options: CreatorCoworkSendOptions) => void | Promise<void>;
  onError?: (message: string) => void;
}

export const useCreatorCoworkBridge = ({
  installedRecommendedSkillIds,
  missingRecommendedSkillIds,
  onSendToCowork,
  onError,
}: UseCreatorCoworkBridgeInput) => {
  const dispatch = useDispatch();
  const [isSendingToCowork, setIsSendingToCowork] = useState(false);

  const dispatchError = useCallback((message: string) => {
    if (onError) {
      onError(message);
      return;
    }
    window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
  }, [onError]);

  const sendAssetToCowork = useCallback(async (asset: CreatorProductionAssetRecord) => {
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
      dispatchError(i18nService.t('creatorSendToCoworkFailed'));
    } finally {
      setIsSendingToCowork(false);
    }
  }, [dispatch, dispatchError, installedRecommendedSkillIds, onSendToCowork]);

  const sendToCowork = useCallback(async (
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
      dispatchError(i18nService.t('creatorSendToCoworkFailed'));
      return false;
    } finally {
      setIsSendingToCowork(false);
    }
  }, [dispatch, dispatchError, installedRecommendedSkillIds, missingRecommendedSkillIds, onSendToCowork]);

  const sendBatchTaskToCowork = useCallback(async (task: CreatorBatchTaskRecord) => {
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
      dispatchError(i18nService.t('creatorSendToCoworkFailed'));
    } finally {
      setIsSendingToCowork(false);
    }
  }, [dispatch, dispatchError, installedRecommendedSkillIds, onSendToCowork]);

  const sendBatchRunToCowork = useCallback(async (batchRun: CreatorBatchRunRecord) => {
    const pendingTasks = batchRun.tasks.filter((task) => task.status === CreatorBatchTaskStatus.Pending);
    if (pendingTasks.length === 0) {
      dispatchError(i18nService.t('creatorBatchNoPendingTasks'));
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
      dispatchError(i18nService.t('creatorSendToCoworkFailed'));
    } finally {
      setIsSendingToCowork(false);
    }
  }, [dispatch, dispatchError, installedRecommendedSkillIds, onSendToCowork]);

  return {
    isSendingToCowork,
    sendAssetToCowork,
    sendBatchRunToCowork,
    sendBatchTaskToCowork,
    sendToCowork,
  };
};
