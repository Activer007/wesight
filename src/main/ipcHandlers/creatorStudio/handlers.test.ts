import type { IpcMain } from 'electron';
import { app, BrowserWindow, dialog } from 'electron';
import { beforeEach, expect, test, vi } from 'vitest';

import {
  CreatorAssetAdoptionStatus,
  CreatorImageMetadataStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingPlanSchemaVersion,
  CreatorImageProcessingPlanStatus,
  CreatorImageProcessingPresetId,
  CreatorImageProcessingRisk,
  CreatorImageProcessingSourceKind,
  CreatorImageProcessingTaskStatus,
  CreatorImageQuickEditSaveMode,
  CreatorLocalImageImportMode,
  CreatorProductionAssetKind,
  CreatorProductionAssetSource,
  CreatorProductionAssetStatus,
  CreatorStudioAssetListMaxLimit,
  CreatorStudioIpcChannel,
} from '../../../shared/creatorStudio/constants';
import type {
  CreatorImageProcessingJob,
  CreatorImageProcessingPlan,
  CreatorImageProcessingTask,
} from '../../../shared/creatorStudio/imageProcessingTypes';
import type { CoworkStore } from '../../coworkStore';
import type { CreatorAssetStore } from '../../creatorAssetStore';
import { registerCreatorStudioIpcHandlers } from './handlers';

const electronMocks = vi.hoisted(() => ({
  getPath: vi.fn(() => '/tmp/wesight-user-data'),
  fromWebContents: vi.fn(() => null),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: electronMocks.getPath,
  },
  BrowserWindow: {
    fromWebContents: electronMocks.fromWebContents,
  },
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog,
    showSaveDialog: electronMocks.showSaveDialog,
  },
  shell: {
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

type RegisteredHandler = (_event: unknown, input?: unknown) => Promise<unknown> | unknown;

const handlers = new Map<string, RegisteredHandler>();

const ipcMain = {
  handle: vi.fn((channel: string, handler: RegisteredHandler) => {
    handlers.set(channel, handler);
  }),
} as unknown as IpcMain;

const createStore = () => ({
  listAssets: vi.fn(() => ({ assets: [], total: 0, limit: 0, offset: 0 })),
  getAsset: vi.fn(),
  getAssetSource: vi.fn(),
  inspectImageAsset: vi.fn(() => ({
    asset: { id: 'asset-1' },
    imageMetadata: {
      sourcePath: '/tmp/image.png',
      width: 20,
      height: 10,
      fileSize: 128,
      format: 'png',
      mimeType: 'image/png',
      hasAlpha: true,
      exifOrientation: null,
      colorSpace: 'srgb',
      inspectedAt: 1,
      status: CreatorImageMetadataStatus.Ready,
      warningCodes: [],
    },
  })),
  setFavorite: vi.fn(),
  updateAsset: vi.fn(),
  createPromptAsset: vi.fn(),
  createCaseAsset: vi.fn(),
  createCaseImageAsset: vi.fn(),
  importLocalImages: vi.fn(() => ({
    assets: [],
    total: 0,
    imported: 0,
    reused: 0,
    skipped: 0,
    failures: [],
  })),
  saveImageQuickEdit: vi.fn(() => ({
    outputPath: '/tmp/output.webp',
    imageMetadata: {
      sourcePath: '/tmp/output.webp',
      width: 20,
      height: 10,
      fileSize: 128,
      format: 'webp',
      mimeType: 'image/webp',
      hasAlpha: false,
      exifOrientation: null,
      colorSpace: 'srgb',
      inspectedAt: 1,
      status: CreatorImageMetadataStatus.Ready,
      warningCodes: [],
    },
    asset: { id: 'asset-output' },
    overwritten: false,
    warningCodes: [],
  })),
  getWorkspace: vi.fn(() => ({ currentProjectId: 'project-1', projects: [], collections: [] })),
  createProject: vi.fn(() => ({ currentProjectId: 'project-2', projects: [], collections: [] })),
  setCurrentProject: vi.fn(() => ({ currentProjectId: 'project-1', projects: [], collections: [] })),
  createCollection: vi.fn(() => ({ currentProjectId: 'project-1', projects: [], collections: [] })),
  addAssetToCollection: vi.fn(),
  getBoardWorkspace: vi.fn(() => ({ projectId: 'project-1', currentBoardId: 'board-1', boards: [], cards: [], selectedCardIds: [], brandKit: null })),
  createBoard: vi.fn(() => ({ projectId: 'project-1', currentBoardId: 'board-2', boards: [], cards: [], selectedCardIds: [], brandKit: null })),
  setCurrentBoard: vi.fn(() => ({ projectId: 'project-1', currentBoardId: 'board-1', boards: [], cards: [], selectedCardIds: [], brandKit: null })),
  addBoardCard: vi.fn(),
  updateBoardCard: vi.fn(),
  removeBoardCard: vi.fn(),
  moveBoardCard: vi.fn(),
  selectBoardCard: vi.fn(),
  buildBoardContextPack: vi.fn(() => ({ boardId: 'board-1', cardIds: [], contextPack: '' })),
  updateBrandKit: vi.fn(() => ({ projectId: 'project-1', currentBoardId: 'board-1', boards: [], cards: [], selectedCardIds: [], brandKit: null })),
  listCreativeModelCapabilities: vi.fn(() => []),
  createBatchRun: vi.fn(() => ({ id: 'batch-1', projectId: 'project-1', tasks: [] })),
  listBatchRuns: vi.fn(() => ({ runs: [], total: 0 })),
  getBatchRun: vi.fn(() => ({ id: 'batch-1', projectId: 'project-1', tasks: [] })),
  retryBatchTask: vi.fn(() => ({ id: 'batch-1', projectId: 'project-1', tasks: [] })),
  skipBatchTask: vi.fn(() => ({ id: 'batch-1', projectId: 'project-1', tasks: [] })),
  failBatchTask: vi.fn(() => ({ id: 'batch-1', projectId: 'project-1', tasks: [] })),
  prepareImageProcessingAsset: vi.fn(async (asset) => asset),
  createImageProcessingAsset: vi.fn(),
  getImageProcessingPlan: vi.fn(() => null),
  executeImageProcessingPlan: vi.fn(),
  executeImageProcessingRecipe: vi.fn(() => ({
    plan: { id: 'plan-recipe' },
    job: { id: 'job-recipe' },
    tasks: [],
    outputAssetIds: ['asset-output'],
  })),
}) as unknown as CreatorAssetStore;

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  vi.mocked(app.getPath).mockReturnValue('/tmp/wesight-user-data');
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(null);
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: undefined });
});

test('registers creator studio asset IPC handlers with constant channels', () => {
  registerCreatorStudioIpcHandlers(ipcMain, createStore);

  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetList, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetGetSource, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImageInspect, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetSetFavorite, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetUpdate, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetCreatePrompt, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetCreateCase, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetCreateCaseImage, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetImportLocalImages, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetImportLocalImageFolder, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.AssetRevealInFolder, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.WorkspaceGet, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ProjectCreate, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ProjectSetCurrent, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.CollectionCreate, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.CollectionAddAsset, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardWorkspaceGet, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardCreate, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardSetCurrent, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardCardAdd, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardCardUpdate, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardCardRemove, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardCardMove, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardCardSelect, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BoardBuildContextPack, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BrandKitUpdate, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ModelCapabilityList, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BatchRunCreate, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BatchRunList, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BatchRunGet, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BatchTaskRetry, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BatchTaskSkip, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.BatchTaskFail, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImagePlanCreate, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImagePlanGet, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImageJobExecute, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImageJobGet, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImageRecipeExecute, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImageOutputReveal, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImageQuickEditSave, expect.any(Function));
  expect(ipcMain.handle).toHaveBeenCalledWith(CreatorStudioIpcChannel.ImageQuickEditReveal, expect.any(Function));
});

test('clamps asset list parameters before reaching the store', async () => {
  const store = createStore();
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.AssetList);
  expect(handler).toBeDefined();
  await handler?.(null, { limit: 9999, offset: -12 });

  expect(store.listAssets).toHaveBeenCalledWith({
    limit: CreatorStudioAssetListMaxLimit,
    offset: 0,
  });
});

test('returns an empty local image import result when file selection is cancelled', async () => {
  const store = createStore();
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.AssetImportLocalImages);
  expect(handler).toBeDefined();
  const result = await handler?.({ sender: {} }, { projectId: 'project-1' });

  expect(result).toEqual({
    success: true,
    assets: [],
    total: 0,
    imported: 0,
    reused: 0,
    skipped: 0,
    failures: [],
  });
  expect(store.importLocalImages).not.toHaveBeenCalled();
});

test('normalizes local image import mode before reaching the store', async () => {
  const store = createStore();
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({
    canceled: false,
    filePaths: ['/tmp/source.png'],
  });
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.AssetImportLocalImages);
  expect(handler).toBeDefined();
  const result = await handler?.({ sender: {} }, {
    projectId: ' project-1 ',
    mode: 'unsafe-mode',
    collectionId: ' collection-1 ',
  });

  expect(result).toMatchObject({ success: true });
  expect(store.importLocalImages).toHaveBeenCalledWith({
    projectId: 'project-1',
    mode: CreatorLocalImageImportMode.Reference,
    collectionId: 'collection-1',
    filePaths: ['/tmp/source.png'],
    managedDirectory: '/tmp/wesight-user-data/creator-assets/local-images/project-1',
  });
});

test('normalizes quick edit save mode before reaching the store', async () => {
  const store = createStore();
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.ImageQuickEditSave);
  expect(handler).toBeDefined();
  const result = await handler?.({ sender: {} }, {
    assetId: ' asset-1 ',
    saveMode: 'replace',
    rotate: 90,
    outputFormat: CreatorImageProcessingOutputFormat.Webp,
  });

  expect(result).toMatchObject({ success: true, outputPath: '/tmp/output.webp' });
  expect(store.saveImageQuickEdit).toHaveBeenCalledWith({
    assetId: 'asset-1',
    saveMode: CreatorImageQuickEditSaveMode.Copy,
    rotate: 90,
    outputFormat: CreatorImageProcessingOutputFormat.Webp,
  });
});

test('returns an empty quick edit result when save_as dialog is cancelled', async () => {
  const store = createStore();
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.ImageQuickEditSave);
  expect(handler).toBeDefined();
  const result = await handler?.({ sender: {} }, {
    assetId: 'asset-1',
    saveMode: CreatorImageQuickEditSaveMode.SaveAs,
  });

  expect(result).toEqual({ success: true, outputPath: '', overwritten: false, warningCodes: [] });
  expect(store.saveImageQuickEdit).not.toHaveBeenCalled();
});

test('returns an empty local image folder import result when folder selection is cancelled', async () => {
  const store = createStore();
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.AssetImportLocalImageFolder);
  expect(handler).toBeDefined();
  const result = await handler?.({ sender: {} }, { projectId: 'project-1' });

  expect(result).toEqual({
    success: true,
    assets: [],
    total: 0,
    imported: 0,
    reused: 0,
    skipped: 0,
    failures: [],
  });
  expect(store.importLocalImages).not.toHaveBeenCalled();
});

test('rejects asset reveal requests without an asset id', async () => {
  registerCreatorStudioIpcHandlers(ipcMain, createStore);

  const handler = handlers.get(CreatorStudioIpcChannel.AssetRevealInFolder);
  expect(handler).toBeDefined();
  const result = await handler?.(null, { filePath: '/tmp/generated.png' });

  expect(result).toEqual({ success: false, error: 'assetId is required' });
});

test('normalizes creator image inspect requests by asset id', async () => {
  const store = createStore();
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.ImageInspect);
  expect(handler).toBeDefined();
  const result = await handler?.(null, { assetId: ' asset-1 ', filePath: '/tmp/ignored.png' });

  expect(result).toMatchObject({ success: true });
  expect(store.inspectImageAsset).toHaveBeenCalledWith({ assetId: 'asset-1' });
});

test('rejects uncontrolled creator image inspect file paths', async () => {
  registerCreatorStudioIpcHandlers(ipcMain, createStore);

  const handler = handlers.get(CreatorStudioIpcChannel.ImageInspect);
  expect(handler).toBeDefined();
  const result = await handler?.(null, { filePath: '/tmp/generated.png' });

  expect(result).toEqual({ success: false, error: 'assetId or controlled source is required' });
});

test('normalizes activity artifact image inspect requests', async () => {
  const store = createStore();
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.ImageInspect);
  expect(handler).toBeDefined();
  const result = await handler?.(null, {
    source: {
      sessionId: ' session-1 ',
      artifactId: ' artifact-1 ',
      filePath: ' /tmp/artifact.png ',
    },
  });

  expect(result).toMatchObject({ success: true });
  expect(store.inspectImageAsset).toHaveBeenCalledWith({
    source: {
      sessionId: 'session-1',
      artifactId: 'artifact-1',
      filePath: '/tmp/artifact.png',
    },
  });
});

test('normalizes image plan creation before reaching planner', async () => {
  const store = createStore();
  vi.mocked(store.getAsset).mockReturnValue({
    id: 'asset-1',
    projectId: 'project-1',
    kind: CreatorProductionAssetKind.Image,
    status: CreatorProductionAssetStatus.Ready,
    source: CreatorProductionAssetSource.CoworkGeneratedImage,
    runId: null,
    variantOfAssetId: null,
    sessionId: null,
    messageId: null,
    templateId: null,
    caseIds: [],
    promptSpec: null,
    promptText: '',
    parentPromptAssetId: null,
    promptVersionId: null,
    recipeId: null,
    selectedDirectionId: null,
    filePath: '/tmp/source.png',
    fileName: 'source.png',
    mimeType: 'image/png',
    favorite: false,
    adoptionStatus: CreatorAssetAdoptionStatus.Unset,
    tags: [],
    collectionIds: [],
    selected: false,
    licenseNote: null,
    usageNote: null,
    createdAt: 1,
    updatedAt: 1,
    sourceSessionAvailable: true,
    imageMetadata: {
      sourcePath: '/tmp/source.png',
      width: 1200,
      height: 900,
      fileSize: 100,
      format: 'png',
      mimeType: 'image/png',
      hasAlpha: false,
      exifOrientation: null,
      colorSpace: 'srgb',
      inspectedAt: 1,
      status: CreatorImageMetadataStatus.Ready,
      warningCodes: [],
    },
  });
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.ImagePlanCreate);
  expect(handler).toBeDefined();
  const result = await handler?.(null, {
    assetId: ' asset-1 ',
    presetId: CreatorImageProcessingPresetId.ReadmeBanner,
    outputFormat: CreatorImageProcessingOutputFormat.Webp,
    quality: 82,
    width: 1600,
    unsafePath: '/tmp/ignored',
  });

  expect(result).toMatchObject({
    success: true,
    plan: {
      presetId: CreatorImageProcessingPresetId.ReadmeBanner,
      output: { format: CreatorImageProcessingOutputFormat.Webp, overwrite: false },
    },
  });
  expect(store.getAsset).toHaveBeenCalledWith('asset-1');
});

test('rejects image job execution without a saved plan', async () => {
  registerCreatorStudioIpcHandlers(ipcMain, createStore);

  const handler = handlers.get(CreatorStudioIpcChannel.ImageJobExecute);
  expect(handler).toBeDefined();
  const result = await handler?.(null, { planId: 'missing-plan' });

  expect(result).toEqual({ success: false, error: 'Image processing plan not found' });
});

test('keeps image job execution successful when cowork result writeback fails', async () => {
  const store = createStore();
  const plan: CreatorImageProcessingPlan = {
    schemaVersion: CreatorImageProcessingPlanSchemaVersion.V1,
    id: 'plan-1',
    projectId: 'project-1',
    source: { sourceKind: CreatorImageProcessingSourceKind.CreatorAsset, assetId: 'asset-source' },
    inputItems: [{
      id: 'input-1',
      source: { sourceKind: CreatorImageProcessingSourceKind.CreatorAsset, assetId: 'asset-source' },
      sourceAssetId: 'asset-source',
      sourcePath: '/tmp/source.png',
      metadata: null,
    }],
    presetId: CreatorImageProcessingPresetId.WebOptimizedWebp,
    operations: [],
    output: {
      format: CreatorImageProcessingOutputFormat.Webp,
      quality: 82,
      outputDirectory: '/tmp',
      fileNamePattern: '{name}.webp',
      overwrite: false,
    },
    outputItems: [{
      inputItemId: 'input-1',
      sourceAssetId: 'asset-source',
      outputDirectory: '/tmp',
      fileName: 'output.webp',
      outputPath: '/tmp/output.webp',
      width: null,
      height: null,
      format: CreatorImageProcessingOutputFormat.Webp,
    }],
    warnings: [],
    estimatedRisk: CreatorImageProcessingRisk.Low,
    createdBy: CreatorImageProcessingCreatedBy.Agent,
    status: CreatorImageProcessingPlanStatus.Ready,
    createdAt: 1,
    updatedAt: 1,
  };
  const job: CreatorImageProcessingJob = {
    id: 'job-1',
    projectId: 'project-1',
    planId: plan.id,
    status: CreatorImageProcessingJobStatus.Completed,
    totalCount: 1,
    successCount: 1,
    failedCount: 0,
    inputTotalSize: 100,
    outputTotalSize: 60,
    savedSize: 40,
    savedPercentage: 40,
    runtimeMetrics: null,
    reportAssetId: null,
    reportPath: null,
    createdAt: 1,
    startedAt: 1,
    completedAt: 2,
  };
  const task: CreatorImageProcessingTask = {
    id: 'task-1',
    jobId: job.id,
    projectId: 'project-1',
    sourceAssetId: 'asset-source',
    outputAssetId: 'asset-output',
    sourceArtifactId: null,
    sourcePath: '/tmp/source.png',
    outputPath: '/tmp/output.webp',
    status: CreatorImageProcessingTaskStatus.Completed,
    inputSize: 100,
    outputSize: 60,
    durationMs: 10,
    errorCode: null,
    errorMessage: null,
    createdAt: 1,
    updatedAt: 2,
    completedAt: 2,
  };
  vi.mocked(store.getImageProcessingPlan).mockReturnValue(plan);
  vi.mocked(store.executeImageProcessingPlan).mockResolvedValue({
    job,
    tasks: [task],
    outputAssetIds: ['asset-output'],
  });
  vi.mocked(store.getAsset).mockImplementation((assetId) => ({
    id: assetId,
    projectId: 'project-1',
    kind: CreatorProductionAssetKind.Image,
    status: CreatorProductionAssetStatus.Ready,
    source: CreatorProductionAssetSource.LocalImageProcessing,
    runId: null,
    variantOfAssetId: assetId === 'asset-output' ? 'asset-source' : null,
    sessionId: null,
    messageId: null,
    templateId: null,
    caseIds: [],
    promptSpec: null,
    promptText: '',
    parentPromptAssetId: null,
    promptVersionId: null,
    recipeId: null,
    selectedDirectionId: null,
    filePath: assetId === 'asset-output' ? '/tmp/output.webp' : '/tmp/source.png',
    fileName: assetId === 'asset-output' ? 'output.webp' : 'source.png',
    mimeType: assetId === 'asset-output' ? 'image/webp' : 'image/png',
    favorite: false,
    adoptionStatus: CreatorAssetAdoptionStatus.Unset,
    tags: [],
    collectionIds: [],
    selected: false,
    licenseNote: null,
    usageNote: null,
    createdAt: 1,
    updatedAt: 1,
    sourceSessionAvailable: true,
    imageMetadata: null,
    imageProcessing: null,
  }));
  const coworkStore = {
    recordImageProcessingExecutionResult: vi.fn(() => {
      throw new Error('session not found');
    }),
  } as unknown as CoworkStore;
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  registerCreatorStudioIpcHandlers(ipcMain, () => store, () => coworkStore);

  const handler = handlers.get(CreatorStudioIpcChannel.ImageJobExecute);
  expect(handler).toBeDefined();
  try {
    const result = await handler?.(null, {
      planId: 'plan-1',
      coworkSessionId: 'missing-session',
      coworkPlanMessageId: 'message-1',
    });

    expect(result).toMatchObject({
      success: true,
      outputAssetIds: ['asset-output'],
      outputAssets: [expect.objectContaining({ id: 'asset-output' })],
    });
    expect(coworkStore.recordImageProcessingExecutionResult).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[CreatorStudio] image processing cowork result writeback failed:',
      expect.any(Error)
    );
  } finally {
    warnSpy.mockRestore();
  }
});

test('normalizes image recipe execution before reaching the store', async () => {
  const store = createStore();
  vi.mocked(store.getAsset).mockReturnValue({
    id: 'asset-output',
    projectId: 'project-1',
    kind: CreatorProductionAssetKind.Image,
    status: CreatorProductionAssetStatus.Ready,
    source: CreatorProductionAssetSource.RecipePostProcessing,
    runId: null,
    variantOfAssetId: 'asset-source',
    sessionId: null,
    messageId: null,
    templateId: null,
    caseIds: [],
    promptSpec: null,
    promptText: '',
    parentPromptAssetId: null,
    promptVersionId: null,
    recipeId: 'recipe-1',
    selectedDirectionId: null,
    filePath: '/tmp/output.webp',
    fileName: 'output.webp',
    mimeType: 'image/webp',
    favorite: false,
    adoptionStatus: CreatorAssetAdoptionStatus.Unset,
    tags: [],
    collectionIds: [],
    selected: false,
    licenseNote: null,
    usageNote: null,
    createdAt: 1,
    updatedAt: 1,
    sourceSessionAvailable: true,
    imageMetadata: null,
    imageProcessing: null,
  });
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.ImageRecipeExecute);
  expect(handler).toBeDefined();
  const result = await handler?.(null, {
    recipeId: ' recipe-1 ',
    assetId: ' asset-source ',
    ruleId: ' readme-banner-webp ',
    outputDirectory: ' /tmp/output ',
    unsafePath: '/tmp/ignored',
  });

  expect(result).toMatchObject({
    success: true,
    outputAssetIds: ['asset-output'],
    outputAssets: [expect.objectContaining({ id: 'asset-output' })],
  });
  expect(store.executeImageProcessingRecipe).toHaveBeenCalledWith({
    recipeId: 'recipe-1',
    assetId: 'asset-source',
    ruleId: 'readme-banner-webp',
    outputDirectory: '/tmp/output',
  });
});

test('normalizes creator batch run creation before reaching the store', async () => {
  const store = createStore();
  registerCreatorStudioIpcHandlers(ipcMain, () => store);

  const handler = handlers.get(CreatorStudioIpcChannel.BatchRunCreate);
  expect(handler).toBeDefined();
  const result = await handler?.(null, {
    projectId: ' project-1 ',
    briefTitle: ' Launch ',
    promptSpec: { sourceTitle: 'Launch' },
    promptText: ' Generate a launch visual. ',
    directions: [{
      id: ' route-a ',
      title: ' Route A ',
      promptText: ' Generate route A. ',
      promptSpec: { sourceTitle: 'Route A' },
    }],
    modelIds: ['seedream-image'],
    templateIds: ['poster-system'],
    sizes: ['1:1'],
  });

  expect(result).toMatchObject({ success: true });
  expect(store.createBatchRun).toHaveBeenCalledWith({
    projectId: 'project-1',
    briefTitle: 'Launch',
    promptSpec: { sourceTitle: 'Launch' },
    promptText: 'Generate a launch visual.',
    directions: [{
      id: 'route-a',
      title: 'Route A',
      template: '',
      style: '',
      reason: '',
      promptFocus: '',
      promptText: 'Generate route A.',
      promptSpec: { sourceTitle: 'Route A' },
    }],
    modelIds: ['seedream-image'],
    templateIds: ['poster-system'],
    sizes: ['1:1'],
  });
});

test('rejects invalid creator batch fail requests', async () => {
  registerCreatorStudioIpcHandlers(ipcMain, createStore);

  const handler = handlers.get(CreatorStudioIpcChannel.BatchTaskFail);
  expect(handler).toBeDefined();
  const result = await handler?.(null, { taskId: 'task-1' });

  expect(result).toEqual({ success: false, error: 'taskId and error are required' });
});
