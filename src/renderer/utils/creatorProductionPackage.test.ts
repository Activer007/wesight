import {
  CreatorAssetAdoptionStatus,
  CreatorBatchRunStatus,
  CreatorBatchTaskStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOutputFormat,
  CreatorImageProcessingPlanSchemaVersion,
  CreatorImageProcessingPlanStatus,
  CreatorImageProcessingPresetId,
  CreatorImageProcessingRisk,
  CreatorImageProcessingSourceKind,
  CreatorImageProcessingTaskStatus,
  CreatorProductionAssetKind,
  CreatorProductionAssetSource,
  CreatorProductionAssetStatus,
  CreatorRecipeImageProcessingPackKind,
  CreatorRecipeOutputKind,
  CreatorRecipeOutputSchemaVersion,
} from '@shared/creatorStudio/constants';
import type {
  CreatorBatchRunRecord,
  CreatorProductionAssetRecord,
  CreatorRecipeRecord,
} from '@shared/creatorStudio/types';
import { describe, expect, test } from 'vitest';

import {
  buildCreatorProductionPackage,
  buildCreatorProductionPerformance,
  CreatorProductionPackageIssueSeverity,
  CreatorProductionPackageSchemaVersion,
  summarizeCreatorProductionPackage,
} from './creatorProductionPackage';

const createAsset = (overrides: Partial<CreatorProductionAssetRecord> = {}): CreatorProductionAssetRecord => ({
  id: 'asset-1',
  projectId: 'project-1',
  kind: CreatorProductionAssetKind.Image,
  status: CreatorProductionAssetStatus.Ready,
  source: CreatorProductionAssetSource.CoworkGeneratedImage,
  runId: 'run-1',
  variantOfAssetId: null,
  sessionId: 'session-1',
  messageId: 'message-1',
  templateId: 'poster',
  caseIds: ['case-1'],
  promptSpec: { schemaVersion: 'creator.prompt.v1', subject: 'Launch' },
  promptText: 'Generate launch image',
  parentPromptAssetId: null,
  promptVersionId: null,
  recipeId: null,
  selectedDirectionId: null,
  filePath: '/tmp/output.png',
  fileName: 'output.png',
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
  imageMetadata: null,
  ...overrides,
  imageProcessing: overrides.imageProcessing ?? null,
});

const createRecipe = (overrides: Partial<CreatorRecipeRecord> = {}): CreatorRecipeRecord => ({
  id: 'recipe-1',
  projectId: 'project-1',
  title: 'Recipe',
  description: null,
  sourcePromptAssetId: null,
  promptSpec: { schemaVersion: 'creator.prompt.v1', subject: 'Launch' },
  defaultRuntime: {},
  defaultOutput: {},
  tags: ['poster'],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const createBatchRun = (overrides: Partial<CreatorBatchRunRecord> = {}): CreatorBatchRunRecord => ({
  id: 'batch-1',
  projectId: 'project-1',
  status: CreatorBatchRunStatus.Completed,
  briefTitle: 'Batch',
  promptSpec: { schemaVersion: 'creator.prompt.v1', subject: 'Launch' },
  promptText: 'Batch prompt',
  summary: {
    taskCount: 2,
    modelIds: ['seedream'],
    modelNames: ['Seedream'],
    templateIds: ['poster'],
    sizes: ['4:5'],
    estimatedCostUnits: 2,
    costUnitLabel: 'unit',
  },
  createdAt: 1,
  updatedAt: 1,
  completedAt: 2,
  tasks: [{
    id: 'task-1',
    batchRunId: 'batch-1',
    projectId: 'project-1',
    status: CreatorBatchTaskStatus.Completed,
    directionId: 'direction-1',
    directionTitle: 'Direction',
    modelId: 'seedream',
    modelName: 'Seedream',
    templateId: 'poster',
    size: '4:5',
    promptSpec: { schemaVersion: 'creator.prompt.v1', subject: 'Launch' },
    promptText: 'Task prompt',
    assetIds: ['asset-1'],
    error: null,
    costEstimateText: '1 unit',
    createdAt: 1,
    updatedAt: 1,
    completedAt: 2,
  }, {
    id: 'task-2',
    batchRunId: 'batch-1',
    projectId: 'project-1',
    status: CreatorBatchTaskStatus.Failed,
    directionId: 'direction-2',
    directionTitle: 'Direction 2',
    modelId: 'seedream',
    modelName: 'Seedream',
    templateId: 'poster',
    size: '4:5',
    promptSpec: { schemaVersion: 'creator.prompt.v1', subject: 'Launch' },
    promptText: 'Task prompt',
    assetIds: [],
    error: 'failed',
    costEstimateText: '1 unit',
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
  }],
  ...overrides,
});

describe('creator production package', () => {
  test('builds a manifest with local adoption metrics', () => {
    const manifest = buildCreatorProductionPackage({
      projectId: 'project-1',
      project: { id: 'project-1', name: 'Project', description: null, createdAt: 1, updatedAt: 1 },
      assets: [
        createAsset({
          selected: true,
          adoptionStatus: CreatorAssetAdoptionStatus.Adopted,
          licenseNote: 'Owned',
          usageNote: 'Campaign',
        }),
        createAsset({ id: 'asset-2', favorite: true, adoptionStatus: CreatorAssetAdoptionStatus.Favorite }),
      ],
      recipes: [createRecipe()],
      batchRuns: [createBatchRun()],
      exportedAt: '2026-06-05T00:00:00.000Z',
    });

    expect(manifest.schemaVersion).toBe(CreatorProductionPackageSchemaVersion.V1);
    expect(manifest.summary.totalAssets).toBe(2);
    expect(manifest.summary.selectedAssets).toBe(1);
    expect(manifest.summary.adoptedAssets).toBe(1);
    expect(manifest.summary.favoriteAssets).toBe(1);
    expect(manifest.summary.completionRate).toBe(50);
    expect(manifest.performance.byTemplate[0]).toMatchObject({
      id: 'poster',
      totalAssets: 2,
      batchTasks: 2,
      completionRate: 50,
    });
    expect(manifest.governance.issues.some((issue) => issue.code === 'failed_batch_tasks')).toBe(true);
  });

  test('aggregates performance by template, model, and direction', () => {
    const performance = buildCreatorProductionPerformance({
      assets: [
        createAsset({
          selected: true,
          adoptionStatus: CreatorAssetAdoptionStatus.Adopted,
          templateId: 'poster',
          selectedDirectionId: 'direction-1',
        }),
        createAsset({
          id: 'asset-2',
          favorite: true,
          adoptionStatus: CreatorAssetAdoptionStatus.Favorite,
          templateId: 'story',
          selectedDirectionId: 'direction-2',
        }),
      ],
      batchRuns: [createBatchRun({
        tasks: [
          {
            ...createBatchRun().tasks[0],
            templateId: 'poster',
            directionId: 'direction-1',
            directionTitle: 'Hero direction',
            modelId: 'seedream',
            modelName: 'Seedream',
            status: CreatorBatchTaskStatus.Completed,
          },
          {
            ...createBatchRun().tasks[1],
            templateId: 'story',
            directionId: 'direction-2',
            directionTitle: 'Story direction',
            modelId: 'gpt-image',
            modelName: 'GPT Image',
            status: CreatorBatchTaskStatus.Failed,
          },
        ],
      })],
    });

    expect(performance.byTemplate[0]).toMatchObject({
      id: 'poster',
      selectedAssets: 1,
      adoptedAssets: 1,
      completedBatchTasks: 1,
      completionRate: 100,
    });
    expect(performance.byModel).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'seedream',
        label: 'Seedream',
        completedBatchTasks: 1,
        completionRate: 100,
      }),
      expect.objectContaining({
        id: 'gpt-image',
        label: 'GPT Image',
        failedBatchTasks: 1,
        completionRate: 0,
      }),
    ]));
    expect(performance.byDirection[0]).toMatchObject({
      id: 'direction-1',
      label: 'Hero direction',
      adoptedAssets: 1,
    });
  });

  test('flags blockers for secrets and missing production files', () => {
    const summary = summarizeCreatorProductionPackage({
      projectId: 'project-1',
      project: null,
      assets: [
        createAsset({
          selected: true,
          status: CreatorProductionAssetStatus.Missing,
          promptText: 'use sk-testsecretvalue1234567890',
        }),
      ],
      recipes: [],
      batchRuns: [],
    });

    expect(summary.blockerCount).toBe(2);
    expect(summary.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: CreatorProductionPackageIssueSeverity.Blocker,
        code: 'sensitive_prompt_values',
      }),
      expect.objectContaining({
        severity: CreatorProductionPackageIssueSeverity.Blocker,
        code: 'missing_production_files',
      }),
    ]));
  });

  test('includes image processing records with recipe lineage and no base64', () => {
    const plan = {
      schemaVersion: CreatorImageProcessingPlanSchemaVersion.V1,
      id: 'plan-readme',
      projectId: 'project-1',
      source: {
        sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
        assetId: 'asset-source',
        recipeId: 'recipe-readme',
      },
      inputItems: [],
      presetId: CreatorImageProcessingPresetId.ReadmeBanner,
      operations: [],
      output: {
        format: CreatorImageProcessingOutputFormat.Webp,
        quality: 82,
        outputDirectory: '/tmp/out',
        fileNamePattern: '{name}.readme-banner.{format}',
        overwrite: false as const,
      },
      outputItems: [],
      warnings: [],
      estimatedRisk: CreatorImageProcessingRisk.Low,
      createdBy: CreatorImageProcessingCreatedBy.Recipe,
      recipeId: 'recipe-readme',
      readmeSuggestions: [{
        outputPath: '/tmp/out/source.readme-banner.webp',
        markdown: '![README banner](assets/source.readme-banner.webp)',
        note: 'Suggestion only.',
      }],
      status: CreatorImageProcessingPlanStatus.Completed,
      createdAt: 1,
      updatedAt: 2,
    };
    const job = {
      id: 'job-readme',
      projectId: 'project-1',
      planId: plan.id,
      status: CreatorImageProcessingJobStatus.Completed,
      totalCount: 1,
      successCount: 1,
      failedCount: 0,
      inputTotalSize: 4000,
      outputTotalSize: 1200,
      savedSize: 2800,
      savedPercentage: 70,
      runtimeMetrics: null,
      reportAssetId: 'asset-report',
      reportPath: '/tmp/out/job-readme-report.md',
      createdAt: 1,
      startedAt: 1,
      completedAt: 2,
    };
    const task = {
      id: 'task-readme',
      jobId: job.id,
      projectId: 'project-1',
      sourceAssetId: 'asset-source',
      outputAssetId: 'asset-derived',
      sourceArtifactId: null,
      sourcePath: '/tmp/source.png',
      outputPath: '/tmp/out/source.readme-banner.webp',
      status: CreatorImageProcessingTaskStatus.Completed,
      inputSize: 4000,
      outputSize: 1200,
      durationMs: 10,
      errorCode: null,
      errorMessage: null,
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
    };
    const sourceAsset = createAsset({
      id: 'asset-source',
      recipeId: 'recipe-readme',
      licenseNote: 'Owned',
      usageNote: 'README',
      promptText: 'Generate README hero',
      promptSpec: { schemaVersion: 'creator.prompt.v1', subject: 'README hero' },
    });
    const derivedAsset = createAsset({
      id: 'asset-derived',
      source: CreatorProductionAssetSource.RecipePostProcessing,
      variantOfAssetId: 'asset-source',
      recipeId: 'recipe-readme',
      licenseNote: 'Owned',
      usageNote: 'README',
      mimeType: 'image/webp',
      filePath: '/tmp/out/source.readme-banner.webp',
      fileName: 'source.readme-banner.webp',
      imageProcessing: {
        sourceAssetId: 'asset-source',
        recipeId: 'recipe-readme',
        presetId: CreatorImageProcessingPresetId.ReadmeBanner,
        operations: [],
        plan,
        job,
        task,
        readmeSuggestions: plan.readmeSuggestions,
      },
    });
    const reportAsset = createAsset({
      id: 'asset-report',
      kind: CreatorProductionAssetKind.Report,
      source: CreatorProductionAssetSource.ImageProcessingReport,
      variantOfAssetId: 'asset-source',
      recipeId: 'recipe-readme',
      mimeType: 'text/markdown',
      filePath: '/tmp/out/job-readme-report.md',
      fileName: 'job-readme-report.md',
      imageProcessing: {
        sourceAssetId: 'asset-source',
        recipeId: 'recipe-readme',
        presetId: CreatorImageProcessingPresetId.ReadmeBanner,
        operations: [],
        plan,
        job,
        task: null,
        tasks: [task],
        report: {
          path: '/tmp/out/job-readme-report.md',
          title: 'Image processing report',
        },
        readmeSuggestions: plan.readmeSuggestions,
      },
    });

    const manifest = buildCreatorProductionPackage({
      projectId: 'project-1',
      project: null,
      assets: [sourceAsset, derivedAsset, reportAsset],
      recipes: [createRecipe({
        id: 'recipe-readme',
        defaultOutput: {
          schemaVersion: CreatorRecipeOutputSchemaVersion.ImageProcessingV1,
          kind: CreatorRecipeOutputKind.ImageProcessing,
          packKind: CreatorRecipeImageProcessingPackKind.ReadmeBannerPack,
          rules: [{
            id: 'readme-banner-webp',
            title: 'README banner WebP',
            presetId: CreatorImageProcessingPresetId.ReadmeBanner,
          }],
          report: { enabled: true },
        },
      })],
      batchRuns: [],
    });

    expect(manifest.imageProcessingRecords).toHaveLength(2);
    expect(manifest.imageProcessingRecords[0]).toMatchObject({
      sourceAssetId: 'asset-source',
      outputAssetId: 'asset-derived',
      recipeId: 'recipe-readme',
      presetId: CreatorImageProcessingPresetId.ReadmeBanner,
      licenseNote: 'Owned',
      usageNote: 'README',
      lineage: {
        variantOfAssetId: 'asset-source',
      },
    });
    expect(manifest.imageProcessingRecords[1]).toMatchObject({
      sourceAssetId: 'asset-source',
      reportAssetId: 'asset-report',
      tasks: [expect.objectContaining({ outputAssetId: 'asset-derived' })],
      report: expect.objectContaining({ title: 'Image processing report' }),
    });
    expect(JSON.stringify(manifest)).not.toMatch(/base64,/i);
  });
});
