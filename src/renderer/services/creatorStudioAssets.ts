import type {
  CreatorImageBatchCreateInput,
  CreatorImageBatchCreateResult,
  CreatorImageJobExecuteInput,
  CreatorImageJobExecuteResult,
  CreatorImageJobGetInput,
  CreatorImageJobGetResult,
  CreatorImageJobListInput,
  CreatorImageJobListResult,
  CreatorImageOutputRevealInput,
  CreatorImagePlanCreateInput,
  CreatorImagePlanCreateResult,
  CreatorImagePlanGetInput,
  CreatorImagePlanGetResult,
  CreatorImageRecipeExecuteInput,
  CreatorImageRecipeExecuteResult,
  CreatorImageReportOpenInput,
  CreatorImageTaskCancelInput,
  CreatorImageTaskCancelResult,
  CreatorImageTaskRetryInput,
  CreatorImageTaskRetryResult,
} from '@shared/creatorStudio/imageProcessingTypes';
import type {
  CreatorAssetCollectionAddInput,
  CreatorAssetCollectionCreateInput,
  CreatorAssetUpdateInput,
  CreatorBatchRunCreateInput,
  CreatorBatchRunListInput,
  CreatorBatchRunListResult,
  CreatorBatchRunRecord,
  CreatorBatchTaskFailInput,
  CreatorBoardCardCreateInput,
  CreatorBoardCardMoveInput,
  CreatorBoardCardRecord,
  CreatorBoardCardSelectInput,
  CreatorBoardCardUpdateInput,
  CreatorBoardContextPackInput,
  CreatorBoardContextPackResult,
  CreatorBoardCreateInput,
  CreatorBoardWorkspaceSnapshot,
  CreatorBrandKitUpdateInput,
  CreatorCaseAssetCreateInput,
  CreatorCreativeModelCapability,
  CreatorImageInspectInput,
  CreatorImageInspectResult,
  CreatorProductionAssetListInput,
  CreatorProductionAssetListResult,
  CreatorProductionAssetRecord,
  CreatorProductionAssetSourceLookup,
  CreatorProjectCreateInput,
  CreatorPromptAssetCreateInput,
  CreatorPromptVersionCreateInput,
  CreatorPromptVersionDiffInput,
  CreatorPromptVersionDiffResult,
  CreatorPromptVersionForkInput,
  CreatorPromptVersionListInput,
  CreatorPromptVersionListResult,
  CreatorPromptVersionRecord,
  CreatorRecipeCreateInput,
  CreatorRecipeImportInput,
  CreatorRecipeListInput,
  CreatorRecipeListResult,
  CreatorRecipeRecord,
  CreatorWorkspaceSnapshot,
} from '@shared/creatorStudio/types';

class CreatorStudioAssetService {
  async listAssets(input: CreatorProductionAssetListInput = {}): Promise<CreatorProductionAssetListResult> {
    const result = await window.electron.creatorStudio.listAssets(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to list creator assets');
    }
    return {
      assets: result.assets ?? [],
      total: result.total ?? 0,
    };
  }

  async getAssetSource(assetId: string): Promise<CreatorProductionAssetSourceLookup | null> {
    const result = await window.electron.creatorStudio.getAssetSource(assetId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get creator asset source');
    }
    return result.source ?? null;
  }

  async inspectImage(input: CreatorImageInspectInput): Promise<CreatorImageInspectResult | null> {
    const result = await window.electron.creatorStudio.inspectImage(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to inspect image metadata');
    }
    if (!result.asset || !result.imageMetadata) {
      return null;
    }
    return {
      asset: result.asset,
      imageMetadata: result.imageMetadata,
    };
  }

  async createImagePlan(input: CreatorImagePlanCreateInput): Promise<CreatorImagePlanCreateResult['plan']> {
    const result = await window.electron.creatorStudio.createImagePlan(input);
    if (!result.success || !result.plan) {
      throw new Error(result.error || 'Failed to create image processing plan');
    }
    return result.plan;
  }

  async getImagePlan(input: CreatorImagePlanGetInput): Promise<CreatorImagePlanGetResult['plan'] | null> {
    const result = await window.electron.creatorStudio.getImagePlan(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get image processing plan');
    }
    return result.plan ?? null;
  }

  async executeImageJob(input: CreatorImageJobExecuteInput): Promise<
    CreatorImageJobExecuteResult & { outputAssets: CreatorProductionAssetRecord[] }
  > {
    const result = await window.electron.creatorStudio.executeImageJob(input);
    if (!result.success || !result.job || !result.tasks) {
      throw new Error(result.error || 'Failed to execute image processing job');
    }
    return {
      job: result.job,
      tasks: result.tasks,
      outputAssetIds: result.outputAssetIds ?? [],
      outputAssets: result.outputAssets ?? [],
    };
  }

  async getImageJob(input: CreatorImageJobGetInput): Promise<CreatorImageJobGetResult | null> {
    const result = await window.electron.creatorStudio.getImageJob(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get image processing job');
    }
    if (!result.job || !result.tasks) return null;
    return { job: result.job, tasks: result.tasks };
  }

  async listImageJobs(input: CreatorImageJobListInput): Promise<CreatorImageJobListResult> {
    const result = await window.electron.creatorStudio.listImageJobs(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to list image processing jobs');
    }
    return {
      jobs: result.jobs ?? [],
      total: result.total ?? 0,
    };
  }

  async createImageBatch(input: CreatorImageBatchCreateInput): Promise<CreatorImageBatchCreateResult> {
    const result = await window.electron.creatorStudio.createImageBatch(input);
    if (!result.success || !result.plan || !result.job || !result.tasks) {
      throw new Error(result.error || 'Failed to create image processing batch');
    }
    return {
      plan: result.plan,
      job: result.job,
      tasks: result.tasks,
      outputAssetIds: result.outputAssetIds ?? [],
    };
  }

  async executeImageRecipe(input: CreatorImageRecipeExecuteInput): Promise<
    CreatorImageRecipeExecuteResult & { outputAssets: CreatorProductionAssetRecord[] }
  > {
    const result = await window.electron.creatorStudio.executeImageRecipe(input);
    if (!result.success || !result.plan || !result.job || !result.tasks) {
      throw new Error(result.error || 'Failed to execute image processing recipe');
    }
    return {
      plan: result.plan,
      job: result.job,
      tasks: result.tasks,
      outputAssetIds: result.outputAssetIds ?? [],
      outputAssets: result.outputAssets ?? [],
    };
  }

  async retryImageTask(input: CreatorImageTaskRetryInput): Promise<CreatorImageTaskRetryResult> {
    const result = await window.electron.creatorStudio.retryImageTask(input);
    if (!result.success || !result.job || !result.tasks) {
      throw new Error(result.error || 'Failed to retry image processing task');
    }
    return {
      job: result.job,
      tasks: result.tasks,
      outputAssetIds: result.outputAssetIds ?? [],
    };
  }

  async cancelImageTask(input: CreatorImageTaskCancelInput): Promise<CreatorImageTaskCancelResult> {
    const result = await window.electron.creatorStudio.cancelImageTask(input);
    if (!result.success || !result.job || !result.tasks) {
      throw new Error(result.error || 'Failed to cancel image processing task');
    }
    return {
      job: result.job,
      tasks: result.tasks,
    };
  }

  async revealImageOutput(input: CreatorImageOutputRevealInput): Promise<void> {
    const result = await window.electron.creatorStudio.revealImageOutput(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to reveal image output');
    }
  }

  async openImageReport(input: CreatorImageReportOpenInput): Promise<void> {
    const result = await window.electron.creatorStudio.openImageReport(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to open image processing report');
    }
  }

  async setFavorite(assetId: string, favorite: boolean): Promise<CreatorProductionAssetRecord | null> {
    const result = await window.electron.creatorStudio.setAssetFavorite({ assetId, favorite });
    if (!result.success) {
      throw new Error(result.error || 'Failed to update creator asset');
    }
    return result.asset ?? null;
  }

  async updateAsset(input: CreatorAssetUpdateInput): Promise<CreatorProductionAssetRecord | null> {
    const result = await window.electron.creatorStudio.updateAsset(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update creator asset');
    }
    return result.asset ?? null;
  }

  async createPromptAsset(input: CreatorPromptAssetCreateInput): Promise<CreatorProductionAssetRecord | null> {
    const result = await window.electron.creatorStudio.createPromptAsset(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save creator prompt asset');
    }
    return result.asset ?? null;
  }

  async createCaseAsset(input: CreatorCaseAssetCreateInput): Promise<CreatorProductionAssetRecord | null> {
    const result = await window.electron.creatorStudio.createCaseAsset(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save creator case asset');
    }
    return result.asset ?? null;
  }

  async revealAssetInFolder(assetId: string): Promise<void> {
    const result = await window.electron.creatorStudio.revealAssetInFolder(assetId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to reveal creator asset');
    }
  }

  async createRecipe(input: CreatorRecipeCreateInput): Promise<CreatorRecipeRecord> {
    const result = await window.electron.creatorStudio.createRecipe(input);
    if (!result.success || !result.recipe) {
      throw new Error(result.error || 'Failed to create creator recipe');
    }
    return result.recipe;
  }

  async importRecipe(input: CreatorRecipeImportInput): Promise<CreatorRecipeRecord> {
    const result = await window.electron.creatorStudio.importRecipe(input);
    if (!result.success || !result.recipe) {
      throw new Error(result.error || 'Failed to import creator recipe');
    }
    return result.recipe;
  }

  async listRecipes(input: CreatorRecipeListInput = {}): Promise<CreatorRecipeListResult> {
    const result = await window.electron.creatorStudio.listRecipes(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to list creator recipes');
    }
    return {
      recipes: result.recipes ?? [],
      total: result.total ?? 0,
    };
  }

  async createPromptVersion(input: CreatorPromptVersionCreateInput): Promise<CreatorPromptVersionRecord> {
    const result = await window.electron.creatorStudio.createPromptVersion(input);
    if (!result.success || !result.version) {
      throw new Error(result.error || 'Failed to create creator prompt version');
    }
    return result.version;
  }

  async listPromptVersions(input: CreatorPromptVersionListInput): Promise<CreatorPromptVersionListResult> {
    const result = await window.electron.creatorStudio.listPromptVersions(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to list creator prompt versions');
    }
    return {
      versions: result.versions ?? [],
      total: result.total ?? 0,
    };
  }

  async forkPromptVersion(input: CreatorPromptVersionForkInput): Promise<CreatorProductionAssetRecord> {
    const result = await window.electron.creatorStudio.forkPromptVersion(input);
    if (!result.success || !result.asset) {
      throw new Error(result.error || 'Failed to fork creator prompt version');
    }
    return result.asset;
  }

  async diffPromptVersions(input: CreatorPromptVersionDiffInput): Promise<CreatorPromptVersionDiffResult> {
    const result = await window.electron.creatorStudio.diffPromptVersions(input);
    if (!result.success || !result.diff) {
      throw new Error(result.error || 'Failed to diff creator prompt versions');
    }
    return result.diff;
  }

  async getWorkspace(): Promise<CreatorWorkspaceSnapshot> {
    const result = await window.electron.creatorStudio.getWorkspace();
    if (!result.success || !result.workspace) {
      throw new Error(result.error || 'Failed to load creator workspace');
    }
    return result.workspace;
  }

  async createProject(input: CreatorProjectCreateInput): Promise<CreatorWorkspaceSnapshot> {
    const result = await window.electron.creatorStudio.createProject(input);
    if (!result.success || !result.workspace) {
      throw new Error(result.error || 'Failed to create creator project');
    }
    return result.workspace;
  }

  async setCurrentProject(projectId: string): Promise<CreatorWorkspaceSnapshot> {
    const result = await window.electron.creatorStudio.setCurrentProject(projectId);
    if (!result.success || !result.workspace) {
      throw new Error(result.error || 'Failed to switch creator project');
    }
    return result.workspace;
  }

  async createCollection(input: CreatorAssetCollectionCreateInput): Promise<CreatorWorkspaceSnapshot> {
    const result = await window.electron.creatorStudio.createCollection(input);
    if (!result.success || !result.workspace) {
      throw new Error(result.error || 'Failed to create creator collection');
    }
    return result.workspace;
  }

  async addAssetToCollection(input: CreatorAssetCollectionAddInput): Promise<CreatorProductionAssetRecord | null> {
    const result = await window.electron.creatorStudio.addAssetToCollection(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to add asset to collection');
    }
    return result.asset ?? null;
  }

  async getBoardWorkspace(projectId?: string): Promise<CreatorBoardWorkspaceSnapshot> {
    const result = await window.electron.creatorStudio.getBoardWorkspace(projectId);
    if (!result.success || !result.workspace) {
      throw new Error(result.error || 'Failed to load creator board');
    }
    return result.workspace;
  }

  async createBoard(input: CreatorBoardCreateInput): Promise<CreatorBoardWorkspaceSnapshot> {
    const result = await window.electron.creatorStudio.createBoard(input);
    if (!result.success || !result.workspace) {
      throw new Error(result.error || 'Failed to create creator board');
    }
    return result.workspace;
  }

  async setCurrentBoard(projectId: string, boardId: string): Promise<CreatorBoardWorkspaceSnapshot> {
    const result = await window.electron.creatorStudio.setCurrentBoard({ projectId, boardId });
    if (!result.success || !result.workspace) {
      throw new Error(result.error || 'Failed to switch creator board');
    }
    return result.workspace;
  }

  async addBoardCard(input: CreatorBoardCardCreateInput): Promise<CreatorBoardCardRecord | null> {
    const result = await window.electron.creatorStudio.addBoardCard(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to add creator board card');
    }
    return result.card ?? null;
  }

  async updateBoardCard(input: CreatorBoardCardUpdateInput): Promise<CreatorBoardCardRecord | null> {
    const result = await window.electron.creatorStudio.updateBoardCard(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update creator board card');
    }
    return result.card ?? null;
  }

  async removeBoardCard(cardId: string): Promise<CreatorBoardCardRecord | null> {
    const result = await window.electron.creatorStudio.removeBoardCard(cardId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to remove creator board card');
    }
    return result.card ?? null;
  }

  async moveBoardCard(input: CreatorBoardCardMoveInput): Promise<CreatorBoardCardRecord | null> {
    const result = await window.electron.creatorStudio.moveBoardCard(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to move creator board card');
    }
    return result.card ?? null;
  }

  async selectBoardCard(input: CreatorBoardCardSelectInput): Promise<CreatorBoardCardRecord | null> {
    const result = await window.electron.creatorStudio.selectBoardCard(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to select creator board card');
    }
    return result.card ?? null;
  }

  async buildBoardContextPack(input: CreatorBoardContextPackInput): Promise<CreatorBoardContextPackResult> {
    const result = await window.electron.creatorStudio.buildBoardContextPack(input);
    if (!result.success || !result.contextPack) {
      throw new Error(result.error || 'Failed to build creator board context pack');
    }
    return result.contextPack;
  }

  async updateBrandKit(input: CreatorBrandKitUpdateInput): Promise<CreatorBoardWorkspaceSnapshot> {
    const result = await window.electron.creatorStudio.updateBrandKit(input);
    if (!result.success || !result.workspace) {
      throw new Error(result.error || 'Failed to update creator brand kit');
    }
    return result.workspace;
  }

  async listModelCapabilities(): Promise<CreatorCreativeModelCapability[]> {
    const result = await window.electron.creatorStudio.listModelCapabilities();
    if (!result.success) {
      throw new Error(result.error || 'Failed to list creative model capabilities');
    }
    return result.capabilities ?? [];
  }

  async createBatchRun(input: CreatorBatchRunCreateInput): Promise<CreatorBatchRunRecord> {
    const result = await window.electron.creatorStudio.createBatchRun(input);
    if (!result.success || !result.batchRun) {
      throw new Error(result.error || 'Failed to create creator batch run');
    }
    return result.batchRun;
  }

  async listBatchRuns(input: CreatorBatchRunListInput = {}): Promise<CreatorBatchRunListResult> {
    const result = await window.electron.creatorStudio.listBatchRuns(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to list creator batch runs');
    }
    return {
      runs: result.runs ?? [],
      total: result.total ?? 0,
    };
  }

  async getBatchRun(batchRunId: string): Promise<CreatorBatchRunRecord | null> {
    const result = await window.electron.creatorStudio.getBatchRun(batchRunId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get creator batch run');
    }
    return result.batchRun ?? null;
  }

  async retryBatchTask(taskId: string): Promise<CreatorBatchRunRecord | null> {
    const result = await window.electron.creatorStudio.retryBatchTask(taskId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to retry creator batch task');
    }
    return result.batchRun ?? null;
  }

  async skipBatchTask(taskId: string): Promise<CreatorBatchRunRecord | null> {
    const result = await window.electron.creatorStudio.skipBatchTask(taskId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to skip creator batch task');
    }
    return result.batchRun ?? null;
  }

  async failBatchTask(input: CreatorBatchTaskFailInput): Promise<CreatorBatchRunRecord | null> {
    const result = await window.electron.creatorStudio.failBatchTask(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to mark creator batch task failed');
    }
    return result.batchRun ?? null;
  }
}

export const creatorStudioAssetService = new CreatorStudioAssetService();
