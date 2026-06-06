import Database from 'better-sqlite3';
import fs from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  CreatorAssetAdoptionStatus,
  CreatorBatchRunStatus,
  CreatorBatchTaskStatus,
  CreatorBoardCardKind,
  CreatorBoardMoveDirection,
  CreatorImageAssetQuality,
  CreatorImageMetadataStatus,
  CreatorImageProcessingCreatedBy,
  CreatorImageProcessingJobStatus,
  CreatorImageProcessingOperation,
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
  CreatorProductionRunStatus,
  CreatorPromptSpecSchemaVersion,
  CreatorRecipeImageProcessingPackKind,
  CreatorRecipeOutputKind,
  CreatorRecipeOutputSchemaVersion,
  CreatorStudioDefaultProjectId,
} from '../shared/creatorStudio/constants';
import {
  CreatorAssetStore,
  parseCreatorRecipeImageProcessingOutput,
  parseCreatorStudioSourceContext,
} from './creatorAssetStore';
import { ensureCreatorImageProcessingSchema } from './creatorImageProcessingSchema';
import { ensureCreatorProductionSchema } from './creatorProductionSchema';

let db: Database.Database;
let store: CreatorAssetStore;
let tempDir: string;
const originalFetch = globalThis.fetch;

const createCoworkTables = () => {
  db.exec(`
    CREATE TABLE cowork_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE cowork_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      sequence INTEGER
    );
  `);
};

const creatorDraft = `General intro

[Creator Studio]

templateId: poster-system
caseIds: case-1, case-2

PromptSpec:
\`\`\`json
{
  "templateId": "poster-system",
  "caseIds": ["case-1", "case-2"],
  "sourceTitle": "Poster System",
  "variantOfAssetId": "asset-parent"
}
\`\`\`

Prompt:
\`\`\`text
Generate a poster.
\`\`\``;

const secondCreatorDraft = `General intro

[Creator Studio]

templateId: product-card
caseIds: case-3

PromptSpec:
\`\`\`json
{
  "templateId": "product-card",
  "caseIds": ["case-3"],
  "sourceTitle": "Product Card"
}
\`\`\`

Prompt:
\`\`\`text
Generate a product card.
\`\`\``;

const creatorBatchDraft = `General intro

[Creator Studio]

batchRunId: batch-run-1
batchTaskId: batch-task-1
templateId: poster-system
caseIds: case-1

PromptSpec:
\`\`\`json
{
  "templateId": "poster-system",
  "caseIds": ["case-1"],
  "sourceTitle": "Batch Task",
  "batch": {
    "batchRunId": "batch-run-1",
    "batchTaskId": "batch-task-1",
    "modelId": "seedream-image"
  }
}
\`\`\`

Prompt:
\`\`\`text
Generate a batch visual.
\`\`\``;

beforeEach(() => {
  db = new Database(':memory:');
  createCoworkTables();
  ensureCreatorProductionSchema(db);
  ensureCreatorImageProcessingSchema(db);
  store = new CreatorAssetStore(db);
  tempDir = path.join(tmpdir(), `wesight-creator-store-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('CreatorAssetStore', () => {
  test('parses creator studio source context from cowork draft', () => {
    const context = parseCreatorStudioSourceContext(creatorDraft);

    expect(context?.templateId).toBe('poster-system');
    expect(context?.caseIds).toEqual(['case-1', 'case-2']);
    expect(context?.promptText).toBe('Generate a poster.');
    expect(context?.promptSpec?.sourceTitle).toBe('Poster System');
    expect(context?.variantOfAssetId).toBe('asset-parent');
  });

  test('parses creator batch ids from cowork draft', () => {
    const context = parseCreatorStudioSourceContext(creatorBatchDraft);

    expect(context?.batchRunId).toBe('batch-run-1');
    expect(context?.batchTaskId).toBe('batch-task-1');
  });

  test('creates run from creator draft and ingests generated image asset', () => {
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-1', 'Creative Producer', 'running', 1, 1);

    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-user',
        type: 'user',
        content: creatorDraft,
        timestamp: 10,
        sequence: 1,
      },
    });

    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-assistant',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 20,
        sequence: 2,
        metadata: {
          generatedImages: [{
            path: '/tmp/generated.png',
            name: 'generated.png',
            mimeType: 'image/png',
            source: 'codex',
          }],
        },
      },
    });

    const result = store.listAssets();
    expect(result.total).toBe(1);
    expect(result.assets[0].templateId).toBe('poster-system');
    expect(result.assets[0].caseIds).toEqual(['case-1', 'case-2']);
    expect(result.assets[0].messageId).toBe('message-assistant');
    expect(result.assets[0].variantOfAssetId).toBe('asset-parent');
    expect(result.assets[0].status).toBe(CreatorProductionAssetStatus.Missing);

    const run = db.prepare('SELECT status, variant_of_asset_id FROM production_runs WHERE session_id = ?').get('session-1') as {
      status: string;
      variant_of_asset_id: string | null;
    };
    expect(run.status).toBe(CreatorProductionRunStatus.Completed);
    expect(run.variant_of_asset_id).toBe('asset-parent');
  });

  test('projects image metadata from production asset metadata json', () => {
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-1', 'Creative Producer', 'running', 1, 1);
    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-assistant',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 20,
        sequence: 2,
        metadata: {
          generatedImages: [{
            path: '/tmp/generated-metadata.png',
            name: 'generated-metadata.png',
            mimeType: 'image/png',
          }],
        },
      },
    });
    const asset = store.listAssets().assets[0];
    db.prepare('UPDATE production_assets SET metadata = ? WHERE id = ?').run(JSON.stringify({
      imageMetadata: {
        sourcePath: '/tmp/generated-metadata.png',
        width: 320,
        height: 180,
        fileSize: 2048,
        format: 'png',
        mimeType: 'image/png',
        hasAlpha: true,
        exifOrientation: null,
        colorSpace: 'srgb',
        inspectedAt: 123,
        status: CreatorImageMetadataStatus.Ready,
        warningCodes: ['large_pixel_count'],
      },
    }), asset.id);

    const updated = store.getAsset(asset.id);
    expect(updated?.imageMetadata).toMatchObject({
      width: 320,
      height: 180,
      fileSize: 2048,
      status: CreatorImageMetadataStatus.Ready,
      warningCodes: ['large_pixel_count'],
    });
  });

  test('preserves thumbnail and remote original source metadata for imported images', () => {
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-remote-original', 'Creative Producer', 'running', 1, 1);
    const thumbnailPath = path.join(tempDir, 'thumbnail.png');
    store.handleCoworkMessageInserted({
      sessionId: 'session-remote-original',
      message: {
        id: 'message-remote-original',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 20,
        sequence: 2,
        metadata: {
          generatedImages: [{
            path: thumbnailPath,
            name: 'thumbnail.png',
            mimeType: 'image/png',
            assetQuality: CreatorImageAssetQuality.Thumbnail,
            thumbnailPath,
            originalUrl: 'https://raw.githubusercontent.com/example/project/main/data/images/original.png',
            thumbnailUrl: './creator-studio/images/thumbnail.png',
            source: 'creator_import',
          }],
        },
      },
    });

    const asset = store.listAssets().assets[0];

    expect(asset.status).toBe(CreatorProductionAssetStatus.Ready);
    expect(asset.imageSource).toMatchObject({
      assetQuality: CreatorImageAssetQuality.Thumbnail,
      localPath: thumbnailPath,
      thumbnailPath,
      originalUrl: 'https://raw.githubusercontent.com/example/project/main/data/images/original.png',
      thumbnailUrl: './creator-studio/images/thumbnail.png',
    });
  });

  test('maps controlled cowork generated image source into a creator asset during inspect', async () => {
    const imagePath = path.join(tempDir, 'controlled-generated.png');
    fs.writeFileSync(imagePath, Buffer.from('not-real-but-present'));
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-controlled', 'Creative Producer', 'running', 1, 1);
    db.prepare('INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('message-user', 'session-controlled', 'user', creatorDraft, null, 10, 1);
    store.handleCoworkMessageInserted({
      sessionId: 'session-controlled',
      message: {
        id: 'message-user',
        type: 'user',
        content: creatorDraft,
        timestamp: 10,
        sequence: 1,
      },
    });
    db.prepare('INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('message-generated', 'session-controlled', 'assistant', 'Generated image', JSON.stringify({
        generatedImages: [{ path: imagePath, name: 'controlled-generated.png', mimeType: 'image/png' }],
      }), 20, 2);

    const result = await store.inspectImageAsset({
      source: {
        sessionId: 'session-controlled',
        messageId: 'message-generated',
        filePath: imagePath,
      },
    });

    expect(result?.asset.source).toBe(CreatorProductionAssetSource.CoworkGeneratedImage);
    expect(result?.asset.sessionId).toBe('session-controlled');
    expect(result?.asset.messageId).toBe('message-generated');
    expect(result?.asset.templateId).toBe('poster-system');
    expect(result?.asset.caseIds).toEqual(['case-1', 'case-2']);
  });

  test('rejects uncontrolled activity image artifact inspect sources', async () => {
    const imagePath = path.join(tempDir, 'uncontrolled-artifact.png');
    fs.writeFileSync(imagePath, Buffer.from('not-real-but-present'));
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-artifact', 'Creative Producer', 'running', 1, 1);
    db.prepare('INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('message-artifact', 'session-artifact', 'assistant', 'No file links here', null, 20, 1);

    const result = await store.inspectImageAsset({
      source: {
        sessionId: 'session-artifact',
        artifactId: 'file:/tmp/uncontrolled-artifact.png',
        filePath: imagePath,
      },
    });

    expect(result).toBeNull();
    expect(store.listAssets().assets.some((asset) => asset.filePath === imagePath)).toBe(false);
  });

  test('maps controlled activity image artifact file links into a creator asset', async () => {
    const imagePath = path.join(tempDir, 'activity-artifact.png');
    fs.writeFileSync(imagePath, Buffer.from('not-real-but-present'));
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-artifact-controlled', 'Creative Producer', 'running', 1, 1);
    db.prepare('INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('message-user-artifact', 'session-artifact-controlled', 'user', creatorDraft, null, 10, 1);
    store.handleCoworkMessageInserted({
      sessionId: 'session-artifact-controlled',
      message: {
        id: 'message-user-artifact',
        type: 'user',
        content: creatorDraft,
        timestamp: 10,
        sequence: 1,
      },
    });
    db.prepare('INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('message-link-artifact', 'session-artifact-controlled', 'assistant', `[artifact](${imagePath})`, null, 20, 2);

    const result = await store.inspectImageAsset({
      source: {
        sessionId: 'session-artifact-controlled',
        artifactId: `file:${imagePath}`,
        filePath: imagePath,
      },
    });

    expect(result?.asset.filePath).toBe(imagePath);
    expect(result?.asset.messageId).toBe('message-link-artifact');
    expect(result?.asset.templateId).toBe('poster-system');
    expect(result?.asset.caseIds).toEqual(['case-1', 'case-2']);
  });

  test('creates a separate run for each creator draft in one session', () => {
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-1', 'Creative Producer', 'running', 1, 1);

    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-user-1',
        type: 'user',
        content: creatorDraft,
        timestamp: 10,
        sequence: 1,
      },
    });
    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-assistant-1',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 20,
        sequence: 2,
        metadata: {
          generatedImages: [{ path: '/tmp/generated-one.png' }],
        },
      },
    });
    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-user-2',
        type: 'user',
        content: secondCreatorDraft,
        timestamp: 30,
        sequence: 3,
      },
    });
    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-assistant-2',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 40,
        sequence: 4,
        metadata: {
          generatedImages: [{ path: '/tmp/generated-two.png' }],
        },
      },
    });

    const result = store.listAssets();
    expect(result.total).toBe(2);
    const firstAsset = result.assets.find((asset) => asset.messageId === 'message-assistant-1');
    const secondAsset = result.assets.find((asset) => asset.messageId === 'message-assistant-2');

    expect(firstAsset?.templateId).toBe('poster-system');
    expect(firstAsset?.caseIds).toEqual(['case-1', 'case-2']);
    expect(secondAsset?.templateId).toBe('product-card');
    expect(secondAsset?.caseIds).toEqual(['case-3']);
    expect(firstAsset?.runId).toBeTruthy();
    expect(secondAsset?.runId).toBeTruthy();
    expect(firstAsset?.runId).not.toBe(secondAsset?.runId);

    const runs = db.prepare('SELECT status, output_asset_ids_json FROM production_runs WHERE session_id = ?').all('session-1') as Array<{
      status: string;
      output_asset_ids_json: string;
    }>;
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.status === CreatorProductionRunStatus.Completed)).toBe(true);
    expect(runs.every((run) => JSON.parse(run.output_asset_ids_json).length === 1)).toBe(true);
  });

  test('keeps asset record when source session is deleted', () => {
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-1', 'Creative Producer', 'running', 1, 1);

    store.createRunFromPrompt('session-1', creatorDraft, 10);
    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-assistant',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 20,
        sequence: 2,
        metadata: {
          generatedImages: [{ path: '/tmp/generated.png' }],
        },
      },
    });

    db.prepare('DELETE FROM cowork_sessions WHERE id = ?').run('session-1');
    const asset = store.listAssets().assets[0];
    const source = store.getAssetSource(asset.id);

    expect(asset.sourceSessionAvailable).toBe(false);
    expect(source?.session).toBeNull();
  });

  test('keeps project asset collections isolated by current project', () => {
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-1', 'Creative Producer', 'running', 1, 1);

    const workspace = store.createProject({ name: 'Launch Campaign' });
    const projectId = workspace.currentProjectId;
    expect(projectId).not.toBe(CreatorStudioDefaultProjectId);

    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-user',
        type: 'user',
        content: creatorDraft,
        timestamp: 10,
        sequence: 1,
      },
    });
    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-assistant',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 20,
        sequence: 2,
        metadata: {
          generatedImages: [{ path: '/tmp/generated-project.png' }],
        },
      },
    });

    expect(store.listAssets({ projectId }).total).toBe(1);
    expect(store.listAssets({ projectId: CreatorStudioDefaultProjectId }).total).toBe(0);

    const collectionWorkspace = store.createCollection({ projectId, name: 'Shortlist' });
    const collection = collectionWorkspace.collections.find((item) => item.name === 'Shortlist')!;
    const asset = store.listAssets({ projectId }).assets[0];
    const updated = store.updateAsset({
      assetId: asset.id,
      adoptionStatus: CreatorAssetAdoptionStatus.Shortlisted,
      tags: ['hero', 'launch'],
      licenseNote: 'Internal generated asset.',
      selected: true,
    });
    expect(updated?.adoptionStatus).toBe(CreatorAssetAdoptionStatus.Shortlisted);
    expect(updated?.tags).toEqual(['hero', 'launch']);
    expect(updated?.licenseNote).toBe('Internal generated asset.');
    expect(updated?.selected).toBe(true);

    const collected = store.addAssetToCollection({ assetId: asset.id, collectionId: collection.id });
    expect(collected?.collectionIds).toContain(collection.id);
    expect(store.listAssets({ projectId, collectionId: collection.id }).total).toBe(1);
    expect(store.listAssets({ projectId, tag: 'hero' }).total).toBe(1);
    expect(store.listAssets({ projectId, adoptionStatus: CreatorAssetAdoptionStatus.Shortlisted }).total).toBe(1);
  });

  test('stores prompt and case assets in the current project without local file backing', () => {
    const workspace = store.createProject({ name: 'Prompt Library' });
    const projectId = workspace.currentProjectId;

    const promptAsset = store.createPromptAsset({
      projectId,
      title: 'Hero Prompt',
      promptText: 'Generate a launch poster.',
      promptSpec: {
        sourceType: 'template',
        sourceId: 'poster-system',
        sourceTitle: 'Poster System',
        templateId: 'poster-system',
        caseIds: ['case-1'],
      },
      templateId: 'poster-system',
      caseIds: ['case-1'],
      tags: ['poster'],
    });

    const caseAsset = store.createCaseAsset({
      projectId,
      caseId: 'case-2',
      title: 'Reference Case',
      promptText: 'Generate a reference composition.',
      sourceLabel: 'awesome-gpt-image-2',
      sourceUrl: 'https://example.com/case',
      githubUrl: 'https://github.com/example/repo',
      category: 'poster',
      styles: ['typography'],
      scenes: ['campaign'],
    });

    expect(promptAsset.kind).toBe(CreatorProductionAssetKind.Prompt);
    expect(promptAsset.status).toBe(CreatorProductionAssetStatus.Ready);
    expect(promptAsset.source).toBe(CreatorProductionAssetSource.CreatorPrompt);
    expect(promptAsset.filePath).toMatch(/^creator:\/\/prompt\//);
    expect(promptAsset.promptSpec?.schemaVersion).toBe(CreatorPromptSpecSchemaVersion.V1);
    expect(promptAsset.promptSpec?.source).toEqual(expect.objectContaining({
      sourceType: 'template',
      sourceId: 'poster-system',
      sourceTitle: 'Poster System',
      templateId: 'poster-system',
      caseIds: ['case-1'],
    }));
    expect(promptAsset.promptSpec?.brief).toBeTruthy();
    expect(promptAsset.promptSpec?.composition).toBeTruthy();
    expect(promptAsset.promptSpec?.style).toBeTruthy();
    expect(promptAsset.promptSpec?.text).toBeTruthy();
    expect(promptAsset.promptSpec?.output).toBeTruthy();
    expect(promptAsset.promptSpec?.template).toBeTruthy();
    expect(promptAsset.promptSpec?.provenance).toBeTruthy();

    expect(caseAsset.kind).toBe(CreatorProductionAssetKind.Case);
    expect(caseAsset.status).toBe(CreatorProductionAssetStatus.Ready);
    expect(caseAsset.source).toBe(CreatorProductionAssetSource.CreatorCase);
    expect(caseAsset.caseIds).toEqual(['case-2']);

    expect(store.listAssets({ projectId }).total).toBe(2);
    expect(store.listAssets({ projectId, source: CreatorProductionAssetSource.CreatorPrompt }).total).toBe(1);
    expect(store.listAssets({ projectId, tag: 'typography' }).total).toBe(1);
  });

  test('stores Nano prompt asset provenance, license, usage, and board metadata', () => {
    const workspace = store.createProject({ name: 'Nano Project' });
    const projectId = workspace.currentProjectId;
    const nanoPromptSpec = {
      sourceType: 'nano_prompt',
      sourceMode: 'nano-remix',
      sourceId: 'nano-supai:6845',
      sourceTitle: 'Nano prompt',
      caseIds: [],
      provenance: {
        nano: {
          sourceId: 'nano-supai',
          promptId: 'nano-supai:6845',
          sourcePromptId: '6845',
          sourceUrl: 'https://example.com/source',
          needReferenceImages: true,
        },
      },
    };

    const asset = store.createPromptAsset({
      projectId,
      title: 'Nano prompt',
      promptText: 'Generate a Nano-inspired image.',
      promptSpec: nanoPromptSpec,
      source: CreatorProductionAssetSource.NanoPrompt,
      licenseNote: 'Keep source attribution.',
      usageNote: 'Needs reference images.',
      metadata: {
        nano: {
          sourcePromptId: '6845',
        },
      },
    });

    expect(asset.source).toBe(CreatorProductionAssetSource.NanoPrompt);
    expect(asset.licenseNote).toBe('Keep source attribution.');
    expect(asset.usageNote).toBe('Needs reference images.');
    expect(asset.promptSpec?.provenance).toMatchObject(nanoPromptSpec.provenance);

    const board = store.getBoardWorkspace(projectId);
    const card = store.addBoardCard({
      boardId: board.currentBoardId,
      kind: CreatorBoardCardKind.Prompt,
      title: 'Nano board card',
      promptText: asset.promptText,
      promptSpec: asset.promptSpec,
      metadata: {
        nanoPromptId: 'nano-supai:6845',
      },
    });

    expect(card.metadata).toMatchObject({ nanoPromptId: 'nano-supai:6845' });
    expect(card.promptSpec?.provenance).toMatchObject(nanoPromptSpec.provenance);
  });

  test('creates reusable creator case image assets for processing', () => {
    const workspace = store.createProject({ name: 'Case Image Project' });
    const projectId = workspace.currentProjectId;

    const imageAsset = store.createCaseImageAsset({
      projectId,
      caseId: 'case-77',
      title: 'Fish Market Cat',
      promptText: 'Generate a CCD street photo.',
      imageThumbnailUrl: './creator-studio/images/case77.jpg',
      imageOriginalUrl: 'https://raw.githubusercontent.com/example/repo/main/data/images/case77.jpg',
      mimeType: 'image/jpeg',
      width: 1024,
      height: 768,
      byteSize: 12345,
      sourceLabel: 'awesome-gpt-image-2',
      sourceUrl: 'https://example.com/case-77',
      githubUrl: 'https://github.com/example/repo',
      category: 'street',
      styles: ['ccd'],
      scenes: ['market'],
    });
    const reused = store.createCaseImageAsset({
      projectId,
      caseId: 'case-77',
      title: 'Fish Market Cat',
      promptText: 'Generate a CCD street photo.',
      imageThumbnailUrl: './creator-studio/images/case77.jpg',
      imageOriginalUrl: 'https://raw.githubusercontent.com/example/repo/main/data/images/case77.jpg',
    });

    expect(reused.id).toBe(imageAsset.id);
    expect(imageAsset.kind).toBe(CreatorProductionAssetKind.Image);
    expect(imageAsset.source).toBe(CreatorProductionAssetSource.CreatorCase);
    expect(imageAsset.status).toBe(CreatorProductionAssetStatus.Ready);
    expect(imageAsset.filePath).toBe('creator://case-image/case-77');
    expect(imageAsset.caseIds).toEqual(['case-77']);
    expect(imageAsset.imageSource).toMatchObject({
      assetQuality: CreatorImageAssetQuality.Thumbnail,
      originalUrl: 'https://raw.githubusercontent.com/example/repo/main/data/images/case77.jpg',
      thumbnailUrl: './creator-studio/images/case77.jpg',
    });
    expect(imageAsset.imageMetadata).toMatchObject({
      width: 1024,
      height: 768,
      fileSize: 12345,
      status: CreatorImageMetadataStatus.Ready,
    });
    expect(store.listAssets({ projectId }).total).toBe(1);
  });

  test('prepares virtual creator case images by downloading the original source', async () => {
    const workspace = store.createProject({ name: 'Case Image Original Project' });
    const projectId = workspace.currentProjectId;
    const originalBuffer = await sharp({
      create: {
        width: 44,
        height: 28,
        channels: 3,
        background: { r: 30, g: 80, b: 130 },
      },
    }).png().toBuffer();
    globalThis.fetch = vi.fn(async () => new Response(originalBuffer, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-length': String(originalBuffer.length),
      },
    })) as typeof fetch;
    const imageAsset = store.createCaseImageAsset({
      projectId,
      caseId: 'case-original',
      title: 'Original Remote Case',
      promptText: 'Generate a reference image.',
      imageThumbnailUrl: './creator-studio/images/case206.jpg',
      imageOriginalUrl: 'https://example.com/creator-store-original.png',
      mimeType: 'image/jpeg',
    });

    const prepared = await store.prepareImageProcessingAsset(imageAsset);

    expect(prepared.filePath).not.toBe('creator://case-image/case-original');
    expect(prepared.imageSource).toMatchObject({
      assetQuality: CreatorImageAssetQuality.Original,
      resolvedReason: 'downloaded_original_url',
    });
    expect(prepared.imageMetadata).toMatchObject({
      width: 44,
      height: 28,
      status: CreatorImageMetadataStatus.Ready,
    });
  });

  test('prepares virtual creator case images with bundled thumbnail fallback warnings', async () => {
    const workspace = store.createProject({ name: 'Case Image Thumbnail Project' });
    const projectId = workspace.currentProjectId;
    const imageAsset = store.createCaseImageAsset({
      projectId,
      caseId: 'case-thumbnail',
      title: 'Thumbnail Fallback Case',
      promptText: 'Generate a reference image.',
      imageThumbnailUrl: './creator-studio/images/case206.jpg',
      imageOriginalUrl: 'http://example.com/original.png',
      mimeType: 'image/jpeg',
    });

    const prepared = await store.prepareImageProcessingAsset(imageAsset);

    expect(prepared.filePath).toBe(path.resolve(process.cwd(), 'public', 'creator-studio/images/case206.jpg'));
    expect(prepared.imageSource).toMatchObject({
      assetQuality: CreatorImageAssetQuality.Thumbnail,
      resolvedReason: 'thumbnail_fallback',
    });
    expect(prepared.imageMetadata?.status).toBe(CreatorImageMetadataStatus.Ready);
    expect(prepared.imageMetadata?.warningCodes).toEqual(expect.arrayContaining([
      'original_download_failed',
      'using_thumbnail_source',
    ]));
  });

  test('imports a local image by reference as a ready image asset', async () => {
    const workspace = store.createProject({ name: 'Local Import Project' });
    const projectId = workspace.currentProjectId;
    const imagePath = path.join(tempDir, 'local-reference.png');
    await sharp({
      create: {
        width: 32,
        height: 18,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 1 },
      },
    }).png().toFile(imagePath);

    const result = await store.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Reference,
      filePaths: [imagePath],
    });

    expect(result).toMatchObject({ total: 1, imported: 1, reused: 0, skipped: 0, failures: [] });
    expect(result.assets[0]).toMatchObject({
      projectId,
      kind: CreatorProductionAssetKind.Image,
      source: CreatorProductionAssetSource.LocalImageImport,
      status: CreatorProductionAssetStatus.Ready,
      filePath: imagePath,
      fileName: 'local-reference.png',
      mimeType: 'image/png',
    });
    expect(result.assets[0].imageMetadata).toMatchObject({
      width: 32,
      height: 18,
      format: 'png',
      status: CreatorImageMetadataStatus.Ready,
    });
    expect(result.assets[0].imageSource).toMatchObject({
      assetQuality: CreatorImageAssetQuality.Original,
      localPath: imagePath,
      provider: CreatorProductionAssetSource.LocalImageImport,
      resolvedPath: imagePath,
      resolvedReason: 'referenced_local_import',
    });
  });

  test('reuses an existing referenced local image import in the same project', async () => {
    const workspace = store.createProject({ name: 'Local Import Reuse Project' });
    const projectId = workspace.currentProjectId;
    const imagePath = path.join(tempDir, 'reuse-reference.jpg');
    await sharp({
      create: {
        width: 20,
        height: 12,
        channels: 3,
        background: { r: 240, g: 210, b: 120 },
      },
    }).jpeg().toFile(imagePath);

    const first = await store.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Reference,
      filePaths: [imagePath],
    });
    const second = await store.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Reference,
      filePaths: [imagePath],
    });

    expect(first.imported).toBe(1);
    expect(second).toMatchObject({ total: 1, imported: 0, reused: 1, skipped: 0, failures: [] });
    expect(second.assets[0].id).toBe(first.assets[0].id);
    expect(store.listAssets({ projectId }).total).toBe(1);
  });

  test('imports copied local images into a managed directory without overwriting files', async () => {
    const workspace = store.createProject({ name: 'Local Import Copy Project' });
    const projectId = workspace.currentProjectId;
    const imagePath = path.join(tempDir, 'copy-source.webp');
    const managedDirectory = path.join(tempDir, 'managed-local-images');
    const existingPath = path.join(managedDirectory, 'copy-source.webp');
    await fs.promises.mkdir(managedDirectory, { recursive: true });
    await fs.promises.writeFile(existingPath, 'existing-file');
    await sharp({
      create: {
        width: 24,
        height: 24,
        channels: 3,
        background: { r: 20, g: 120, b: 180 },
      },
    }).webp().toFile(imagePath);

    const result = await store.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Copy,
      managedDirectory,
      filePaths: [imagePath],
    });
    const reused = await store.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Copy,
      managedDirectory,
      filePaths: [imagePath],
    });

    expect(result).toMatchObject({ total: 1, imported: 1, reused: 0, skipped: 0, failures: [] });
    expect(result.assets[0].filePath).toBe(path.join(managedDirectory, 'copy-source-1.webp'));
    expect(result.assets[0].imageSource).toMatchObject({
      assetQuality: CreatorImageAssetQuality.Original,
      localPath: path.join(managedDirectory, 'copy-source-1.webp'),
      resolvedReason: 'copied_local_import',
    });
    expect(reused).toMatchObject({ total: 1, imported: 0, reused: 1, skipped: 0, failures: [] });
    expect(reused.assets[0].id).toBe(result.assets[0].id);
    expect(await fs.promises.readFile(existingPath, 'utf8')).toBe('existing-file');
  });

  test('keeps importing valid local images when one file is corrupt', async () => {
    const workspace = store.createProject({ name: 'Local Import Partial Project' });
    const projectId = workspace.currentProjectId;
    const validPath = path.join(tempDir, 'valid-local.png');
    const corruptPath = path.join(tempDir, 'corrupt-local.png');
    await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 4,
        background: { r: 80, g: 60, b: 180, alpha: 1 },
      },
    }).png().toFile(validPath);
    await fs.promises.writeFile(corruptPath, 'not an image');

    const result = await store.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Reference,
      filePaths: [validPath, corruptPath],
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.failures).toEqual([expect.objectContaining({ path: corruptPath })]);
    expect(store.listAssets({ projectId }).total).toBe(1);
    expect(store.listAssets({ projectId }).assets[0].filePath).toBe(validPath);
  });

  test('creates a derived asset when saving a quick edit copy', async () => {
    const workspace = store.createProject({ name: 'Quick Edit Copy Project' });
    const projectId = workspace.currentProjectId;
    const imagePath = path.join(tempDir, 'quick-copy.png');
    await sharp({
      create: {
        width: 80,
        height: 40,
        channels: 3,
        background: { r: 80, g: 120, b: 180 },
      },
    }).png().toFile(imagePath);
    const imported = await store.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Reference,
      filePaths: [imagePath],
    });

    const result = await store.saveImageQuickEdit({
      assetId: imported.assets[0].id,
      saveMode: CreatorImageQuickEditSaveMode.Copy,
      outputFormat: CreatorImageProcessingOutputFormat.Webp,
      width: 40,
      keepAspect: true,
    });

    expect(result.overwritten).toBe(false);
    expect(result.asset).toMatchObject({
      kind: CreatorProductionAssetKind.Image,
      source: CreatorProductionAssetSource.LocalImageProcessing,
      variantOfAssetId: imported.assets[0].id,
      filePath: path.join(tempDir, 'quick-copy-edited.webp'),
    });
    expect(store.getAssetByFilePath(result.outputPath)?.id).toBe(result.asset?.id);
    expect(result.asset?.imageProcessing).toMatchObject({
      sourceAssetId: imported.assets[0].id,
      quickEdit: {
        saveMode: CreatorImageQuickEditSaveMode.Copy,
        outputPath: path.join(tempDir, 'quick-copy-edited.webp'),
      },
    });
    expect(result.imageMetadata).toMatchObject({
      width: 40,
      height: 20,
      format: CreatorImageProcessingOutputFormat.Webp,
    });
  });

  test('overwrites an imported local image without creating a derived asset', async () => {
    const workspace = store.createProject({ name: 'Quick Edit Overwrite Project' });
    const projectId = workspace.currentProjectId;
    const imagePath = path.join(tempDir, 'quick-overwrite.png');
    await sharp({
      create: {
        width: 30,
        height: 60,
        channels: 3,
        background: { r: 180, g: 80, b: 120 },
      },
    }).png().toFile(imagePath);
    const imported = await store.importLocalImages({
      projectId,
      mode: CreatorLocalImageImportMode.Reference,
      filePaths: [imagePath],
    });

    const result = await store.saveImageQuickEdit({
      assetId: imported.assets[0].id,
      saveMode: CreatorImageQuickEditSaveMode.Overwrite,
      outputFormat: CreatorImageProcessingOutputFormat.Png,
      rotate: 90,
    });

    expect(result.overwritten).toBe(true);
    expect(result.asset?.id).toBe(imported.assets[0].id);
    expect(store.listAssets({ projectId }).total).toBe(1);
    const updated = store.getAsset(imported.assets[0].id);
    expect(updated?.imageMetadata).toMatchObject({
      width: 60,
      height: 30,
      format: CreatorImageProcessingOutputFormat.Png,
    });
  });

  test('tracks prompt versions, recipes, diffs, and forks', () => {
    const workspace = store.createProject({ name: 'Recipe Project' });
    const projectId = workspace.currentProjectId;
    const promptAsset = store.createPromptAsset({
      projectId,
      title: 'Reusable Poster Prompt',
      promptText: 'Generate a launch poster.',
      promptSpec: {
        sourceTitle: 'Reusable Poster Prompt',
        templateId: 'poster-system',
        caseIds: ['case-1'],
        subject: 'Launch poster',
      },
      templateId: 'poster-system',
      caseIds: ['case-1'],
      selectedDirectionId: 'bold',
      tags: ['poster', 'launch'],
    });

    expect(promptAsset.promptVersionId).toBeTruthy();
    expect(promptAsset.selectedDirectionId).toBe('bold');

    const firstVersions = store.listPromptVersions({ promptAssetId: promptAsset.id });
    expect(firstVersions.total).toBe(1);
    expect(firstVersions.versions[0].version).toBe(1);

    const secondVersion = store.createPromptVersion({
      promptAssetId: promptAsset.id,
      promptText: 'Generate a refined launch poster.',
      promptSpec: {
        ...promptAsset.promptSpec!,
        subject: 'Refined launch poster',
      },
      changeNote: 'Refine subject',
    });
    expect(secondVersion.version).toBe(2);

    const diff = store.diffPromptVersions({
      fromVersionId: firstVersions.versions[0].id,
      toVersionId: secondVersion.id,
    });
    expect(diff.promptTextChanged).toBe(true);
    expect(diff.promptSpecChanged).toBe(true);

    const recipe = store.createRecipe({
      projectId,
      title: 'Weekly launch poster',
      sourcePromptAssetId: promptAsset.id,
      promptSpec: secondVersion.promptSpec,
      defaultRuntime: { modelId: 'seedream-image' },
      defaultOutput: { aspectRatio: '1:1' },
      tags: ['poster', 'weekly'],
    });
    expect(recipe.sourcePromptAssetId).toBe(promptAsset.id);
    expect(store.listRecipes({ projectId, tag: 'weekly' }).total).toBe(1);

    const imported = store.importRecipe({
      projectId,
      recipe: {
        title: 'Imported poster recipe',
        promptSpec: recipe.promptSpec,
        tags: ['imported'],
      },
    });
    expect(imported.title).toBe('Imported poster recipe');

    const forked = store.forkPromptVersion({
      promptVersionId: firstVersions.versions[0].id,
      projectId,
      title: 'Rollback fork',
    });
    expect(forked.parentPromptAssetId).toBe(promptAsset.id);
    expect(forked.promptText).toBe('Generate a launch poster.');
    expect(store.listPromptVersions({ promptAssetId: forked.id }).total).toBe(1);
  });

  test('carries prompt version and recipe lineage from cowork draft to generated assets', () => {
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-1', 'Creative Producer', 'running', 1, 1);
    const workspace = store.createProject({ name: 'Lineage Project' });
    const projectId = workspace.currentProjectId;
    const promptAsset = store.createPromptAsset({
      projectId,
      title: 'Lineage Prompt',
      promptText: 'Generate a lineage visual.',
      promptSpec: {
        sourceTitle: 'Lineage Prompt',
        templateId: 'poster-system',
        caseIds: ['case-1'],
      },
      templateId: 'poster-system',
      caseIds: ['case-1'],
      selectedDirectionId: 'route-a',
    });
    const recipe = store.createRecipe({
      projectId,
      title: 'Lineage recipe',
      sourcePromptAssetId: promptAsset.id,
      promptSpec: promptAsset.promptSpec!,
    });

    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-user',
        type: 'user',
        content: [
          '[Creator Studio]',
          '',
          `promptVersionId: ${promptAsset.promptVersionId}`,
          `recipeId: ${recipe.id}`,
          'selectedDirectionId: route-a',
          'templateId: poster-system',
          '',
          'PromptSpec:',
          '```json',
          JSON.stringify({
            ...promptAsset.promptSpec,
            promptVersionId: promptAsset.promptVersionId,
            recipeId: recipe.id,
            selectedDirectionId: 'route-a',
          }, null, 2),
          '```',
          '',
          'Prompt:',
          '```text',
          promptAsset.promptText,
          '```',
        ].join('\n'),
        timestamp: 10,
        sequence: 1,
      },
    });
    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-assistant',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 20,
        sequence: 2,
        metadata: {
          generatedImages: [{ path: '/tmp/generated-lineage.png' }],
        },
      },
    });

    const asset = store.listAssets({ projectId }).assets.find((item) => item.kind === CreatorProductionAssetKind.Image);
    expect(asset?.promptVersionId).toBe(promptAsset.promptVersionId);
    expect(asset?.recipeId).toBe(recipe.id);
    expect(asset?.selectedDirectionId).toBe('route-a');
  });

  test('persists project boards, card selection, context packs, and brand kit', () => {
    const workspace = store.createProject({ name: 'Board Project' });
    const projectId = workspace.currentProjectId;
    const boardWorkspace = store.getBoardWorkspace(projectId);

    expect(boardWorkspace.projectId).toBe(projectId);
    expect(boardWorkspace.boards).toHaveLength(1);
    expect(boardWorkspace.cards).toHaveLength(0);
    const asset = store.createPromptAsset({
      projectId,
      title: 'Reference prompt asset',
      promptText: 'Generate a reusable reference image.',
      promptSpec: {
        sourceTitle: 'Reference prompt asset',
        templateId: 'poster-system',
        caseIds: ['case-9'],
      },
      templateId: 'poster-system',
      caseIds: ['case-9'],
      tags: ['reference', 'poster'],
    });

    const promptCard = store.addBoardCard({
      boardId: boardWorkspace.currentBoardId,
      kind: CreatorBoardCardKind.Prompt,
      title: 'Launch prompt',
      promptText: 'Generate a launch visual.',
      promptSpec: { sourceTitle: 'Launch prompt', caseIds: [] },
      groupName: 'Round 1',
    });
    const assetCard = store.addBoardCard({
      boardId: boardWorkspace.currentBoardId,
      kind: CreatorBoardCardKind.Asset,
      title: 'Reference asset',
      assetId: asset.id,
      groupName: 'style-reference',
      notes: 'Use as a visual system reference.',
    });
    const directionCard = store.addBoardCard({
      boardId: boardWorkspace.currentBoardId,
      kind: CreatorBoardCardKind.Direction,
      title: 'Bold route',
      direction: {
        id: 'bold',
        title: 'Bold route',
        template: 'Large headline',
        style: 'High contrast',
        reason: 'Social launch',
        promptFocus: 'Increase visual contrast.',
      },
    });
    const renamedDirection = store.updateBoardCard({
      cardId: directionCard.id,
      title: 'Renamed bold route',
    });
    expect(renamedDirection?.direction?.title).toBe('Renamed bold route');

    store.selectBoardCard({ cardId: promptCard.id, selected: true });
    store.selectBoardCard({ cardId: assetCard.id, selected: true });
    store.selectBoardCard({ cardId: directionCard.id, selected: true });
    store.moveBoardCard({ cardId: directionCard.id, direction: CreatorBoardMoveDirection.Up });

    const updated = store.updateBrandKit({
      projectId,
      colors: ['#112233', '#ffffff'],
      bannedWords: ['cheap'],
      tone: 'confident',
      visualPreferences: 'clean grid, premium lighting',
    });
    expect(updated.brandKit.colors).toEqual(['#112233', '#ffffff']);
    expect(updated.brandKit.bannedWords).toEqual(['cheap']);

    const context = store.buildBoardContextPack({ boardId: boardWorkspace.currentBoardId });
    expect(context.cardIds).toHaveLength(3);
    expect(context.contextPack).toContain('Board: Creative Board');
    expect(context.contextPack).toContain('Launch prompt');
    expect(context.contextPack).toContain('Renamed bold route');
    expect(context.contextPack).toContain('assetKind=prompt');
    expect(context.contextPack).toContain('assetSource=creator_prompt');
    expect(context.contextPack).toContain('filePath=creator://prompt/');
    expect(context.contextPack).toContain('assetRole=style-reference');
    expect(context.contextPack).toContain('templateId=poster-system');
    expect(context.contextPack).toContain('tags=reference, poster');
    expect(context.contextPack).toContain('cheap');

    const secondBoard = store.createBoard({ projectId, name: 'Round 2' });
    expect(secondBoard.currentBoardId).not.toBe(boardWorkspace.currentBoardId);
    expect(store.setCurrentBoard(projectId, boardWorkspace.currentBoardId).currentBoardId).toBe(boardWorkspace.currentBoardId);
  });

  test('requires explicit board selection before building context pack', () => {
    const workspace = store.createProject({ name: 'Empty Selection Project' });
    const boardWorkspace = store.getBoardWorkspace(workspace.currentProjectId);
    store.addBoardCard({
      boardId: boardWorkspace.currentBoardId,
      kind: CreatorBoardCardKind.Prompt,
      title: 'Unselected prompt',
      promptText: 'Keep this unselected.',
    });

    expect(() => store.buildBoardContextPack({ boardId: boardWorkspace.currentBoardId }))
      .toThrow('Board selection is empty');
  });

  test('creates batch run matrix from directions, models, templates, and sizes', () => {
    const workspace = store.createProject({ name: 'Batch Project' });
    const projectId = workspace.currentProjectId;
    const capabilities = store.listCreativeModelCapabilities();
    expect(capabilities.some((model) => model.supportsBatch)).toBe(true);

    const batchRun = store.createBatchRun({
      projectId,
      briefTitle: 'Launch visual batch',
      promptSpec: {
        sourceTitle: 'Launch visual',
        subject: 'New product launch',
        templateId: 'poster-system',
        caseIds: ['case-1'],
        constraints: { aspectRatio: '1:1' },
      },
      promptText: 'Generate a launch visual.',
      directions: [
        {
          id: 'bold',
          title: 'Bold route',
          template: 'Poster',
          style: 'High contrast',
          reason: 'Awareness',
          promptFocus: 'Use a large headline.',
          promptText: 'Generate a bold launch visual.',
          promptSpec: { sourceTitle: 'Bold route', constraints: { aspectRatio: '1:1' } },
        },
        {
          id: 'detail',
          title: 'Detail route',
          template: 'Product detail',
          style: 'Macro',
          reason: 'Consideration',
          promptFocus: 'Emphasize product texture.',
          promptText: 'Generate a detail launch visual.',
          promptSpec: { sourceTitle: 'Detail route', constraints: { aspectRatio: '1:1' } },
        },
      ],
      modelIds: ['seedream-image', 'prompt-only-review'],
      templateIds: ['poster-system', 'product-card'],
      sizes: ['1:1', '16:9'],
    });

    expect(batchRun.status).toBe(CreatorBatchRunStatus.Running);
    expect(batchRun.summary.taskCount).toBe(16);
    expect(batchRun.summary.modelIds).toEqual(['seedream-image', 'prompt-only-review']);
    expect(batchRun.summary.templateIds).toEqual(['poster-system', 'product-card']);
    expect(batchRun.summary.sizes).toEqual(['1:1', '16:9']);
    expect(batchRun.tasks).toHaveLength(16);
    expect(batchRun.tasks[0].status).toBe(CreatorBatchTaskStatus.Pending);
    expect(batchRun.promptSpec.schemaVersion).toBe(CreatorPromptSpecSchemaVersion.V1);
    expect(batchRun.tasks[0].promptText).toContain('Batch execution constraints');
    expect(batchRun.tasks[0].promptText).toContain('[Creator Studio]');
    expect(batchRun.tasks[0].promptText).toContain(`batchRunId: ${batchRun.id}`);
    expect(batchRun.tasks[0].promptText).toContain(`batchTaskId: ${batchRun.tasks[0].id}`);
    expect(batchRun.tasks[0].promptText).toContain('PromptSpec:');
    expect(batchRun.tasks[0].promptSpec.batch).toMatchObject({
      batchRunId: batchRun.id,
      batchTaskId: batchRun.tasks[0].id,
      modelId: batchRun.tasks[0].modelId,
    });
    expect(batchRun.tasks[0].promptSpec.schemaVersion).toBe(CreatorPromptSpecSchemaVersion.V1);

    const context = parseCreatorStudioSourceContext(batchRun.tasks[0].promptText);
    expect(context?.batchRunId).toBe(batchRun.id);
    expect(context?.batchTaskId).toBe(batchRun.tasks[0].id);
    expect(context?.promptSpec?.schemaVersion).toBe(CreatorPromptSpecSchemaVersion.V1);
    expect(context?.promptText).toContain('Generate a bold launch visual.');

    const listed = store.listBatchRuns({ projectId });
    expect(listed.total).toBe(1);
    expect(listed.runs[0].tasks).toHaveLength(16);
  });

  test('skips and retries individual batch tasks without blocking the run', () => {
    const workspace = store.createProject({ name: 'Batch Recovery Project' });
    const batchRun = store.createBatchRun({
      projectId: workspace.currentProjectId,
      briefTitle: 'Recovery batch',
      promptSpec: { sourceTitle: 'Recovery batch', constraints: { aspectRatio: '1:1' } },
      promptText: 'Generate a recovery visual.',
      directions: [{
        id: 'route-a',
        title: 'Route A',
        template: 'Poster',
        style: 'Clean',
        reason: 'Baseline',
        promptFocus: 'Simple layout.',
        promptText: 'Generate route A.',
        promptSpec: { sourceTitle: 'Route A', constraints: { aspectRatio: '1:1' } },
      }],
      modelIds: ['seedream-image'],
      templateIds: ['poster-system'],
      sizes: ['1:1', '16:9'],
    });
    const [firstTask, secondTask] = batchRun.tasks;

    const afterSkip = store.skipBatchTask(firstTask.id);
    expect(afterSkip?.tasks.find((task) => task.id === firstTask.id)?.status).toBe(CreatorBatchTaskStatus.Skipped);
    expect(afterSkip?.tasks.find((task) => task.id === secondTask.id)?.status).toBe(CreatorBatchTaskStatus.Pending);
    expect(afterSkip?.status).toBe(CreatorBatchRunStatus.Running);

    db.prepare('UPDATE creator_batch_tasks SET status = ?, completed_at = ? WHERE id = ?')
      .run(CreatorBatchTaskStatus.Completed, Date.now(), secondTask.id);
    store.skipBatchTask(firstTask.id);
    const partial = store.getBatchRun(batchRun.id);
    expect(partial?.status).toBe(CreatorBatchRunStatus.PartialFailed);

    const retried = store.retryBatchTask(firstTask.id);
    expect(retried?.status).toBe(CreatorBatchRunStatus.Running);
    expect(retried?.tasks.find((task) => task.id === firstTask.id)?.status).toBe(CreatorBatchTaskStatus.Pending);
  });

  test('rejects unsupported or oversized batch model plans', () => {
    const workspace = store.createProject({ name: 'Batch Guard Project' });
    const baseInput = {
      projectId: workspace.currentProjectId,
      briefTitle: 'Guard batch',
      promptSpec: { sourceTitle: 'Guard batch', constraints: { aspectRatio: '1:1' } },
      promptText: 'Generate a guarded visual.',
      directions: [{
        id: 'route-a',
        title: 'Route A',
        template: 'Poster',
        style: 'Clean',
        reason: 'Baseline',
        promptFocus: 'Simple layout.',
        promptText: 'Generate route A.',
        promptSpec: { sourceTitle: 'Route A', constraints: { aspectRatio: '1:1' } },
      }],
      templateIds: ['poster-system'],
      sizes: ['1:1'],
    };

    expect(() => store.createBatchRun({
      ...baseInput,
      modelIds: ['seedance-video'],
    })).toThrow('Model does not support batch');

    expect(() => store.createBatchRun({
      ...baseInput,
      directions: Array.from({ length: 6 }, (_, index) => ({
        ...baseInput.directions[0],
        id: `route-${index}`,
        title: `Route ${index}`,
      })),
      modelIds: ['seedream-image'],
      templateIds: ['poster-system', 'product-card', 'campaign-poster'],
      sizes: ['1:1', '4:5', '16:9', '3:2', '9:16'],
    })).toThrow('Batch task count exceeds model limit');
  });

  test('marks batch tasks completed from generated images and failed from store API', () => {
    db.prepare('INSERT INTO cowork_sessions (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('session-1', 'Creative Producer', 'running', 1, 1);

    const workspace = store.createProject({ name: 'Batch Completion Project' });
    const batchRun = store.createBatchRun({
      projectId: workspace.currentProjectId,
      briefTitle: 'Completion batch',
      promptSpec: { sourceTitle: 'Completion batch', constraints: { aspectRatio: '1:1' } },
      promptText: 'Generate a completion visual.',
      directions: [{
        id: 'route-a',
        title: 'Route A',
        template: 'Poster',
        style: 'Clean',
        reason: 'Baseline',
        promptFocus: 'Simple layout.',
        promptText: 'Generate route A.',
        promptSpec: { sourceTitle: 'Route A', constraints: { aspectRatio: '1:1' } },
      }],
      modelIds: ['seedream-image'],
      templateIds: ['poster-system'],
      sizes: ['1:1', '16:9'],
    });
    const [firstTask, secondTask] = batchRun.tasks;

    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-user',
        type: 'user',
        content: [
          '[Creator Studio]',
          '',
          `batchRunId: ${batchRun.id}`,
          `batchTaskId: ${firstTask.id}`,
          `templateId: ${firstTask.templateId}`,
          '',
          'PromptSpec:',
          '```json',
          JSON.stringify(firstTask.promptSpec, null, 2),
          '```',
          '',
          'Prompt:',
          '```text',
          firstTask.promptText,
          '```',
        ].join('\n'),
        timestamp: 10,
        sequence: 1,
      },
    });
    store.handleCoworkMessageInserted({
      sessionId: 'session-1',
      message: {
        id: 'message-assistant',
        type: 'assistant',
        content: 'Generated image',
        timestamp: 20,
        sequence: 2,
        metadata: {
          generatedImages: [{ path: '/tmp/generated-batch.png' }],
        },
      },
    });

    const completed = store.getBatchRun(batchRun.id);
    const completedTask = completed?.tasks.find((task) => task.id === firstTask.id);
    expect(completedTask?.status).toBe(CreatorBatchTaskStatus.Completed);
    expect(completedTask?.assetIds).toHaveLength(1);
    expect(completed?.status).toBe(CreatorBatchRunStatus.Running);

    const failed = store.failBatchTask({ taskId: secondTask.id, error: 'Provider timeout' });
    const failedTask = failed?.tasks.find((task) => task.id === secondTask.id);
    expect(failedTask?.status).toBe(CreatorBatchTaskStatus.Failed);
    expect(failedTask?.error).toBe('Provider timeout');
    expect(failed?.status).toBe(CreatorBatchRunStatus.PartialFailed);
  });

  test('creates local image processing derived asset with source lineage', () => {
    const workspace = store.createProject({ name: 'Derived Project' });
    const sourcePath = path.join(tempDir, 'source.png');
    const outputPath = path.join(tempDir, 'source.web-optimized.100x80.webp');
    fs.writeFileSync(sourcePath, Buffer.from('source'));
    fs.writeFileSync(outputPath, Buffer.from('output'));

    db.prepare(`
      INSERT INTO production_assets (
        id, project_id, kind, title, status, source, run_id, source_run_id, variant_of_asset_id,
        session_id, source_session_id, message_id, source_message_id, template_id, case_ids, case_ids_json,
        prompt_spec, prompt_spec_json, prompt_text, parent_prompt_asset_id, prompt_version_id, recipe_id,
        selected_direction_id, file_path, file_name, mime_type, favorite, adoption_status, tags_json,
        license_note, usage_note, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'source-asset',
      workspace.currentProjectId,
      CreatorProductionAssetKind.Image,
      'Source',
      CreatorProductionAssetStatus.Ready,
      CreatorProductionAssetSource.CoworkGeneratedImage,
      'run-1',
      'run-1',
      null,
      'session-1',
      'session-1',
      'message-1',
      'message-1',
      'poster-system',
      JSON.stringify(['case-1']),
      JSON.stringify(['case-1']),
      JSON.stringify({ schemaVersion: CreatorPromptSpecSchemaVersion.V1, sourceTitle: 'Source' }),
      JSON.stringify({ schemaVersion: CreatorPromptSpecSchemaVersion.V1, sourceTitle: 'Source' }),
      'Generate source.',
      null,
      'version-1',
      'recipe-1',
      'direction-1',
      sourcePath,
      'source.png',
      'image/png',
      0,
      CreatorAssetAdoptionStatus.Unset,
      JSON.stringify(['tag-a']),
      'license',
      'usage',
      JSON.stringify({}),
      1,
      1,
    );

    const imageMetadata = {
      sourcePath: outputPath,
      width: 100,
      height: 80,
      fileSize: 6,
      format: CreatorImageProcessingOutputFormat.Webp,
      mimeType: 'image/webp',
      hasAlpha: false,
      exifOrientation: null,
      colorSpace: 'srgb',
      inspectedAt: 2,
      status: CreatorImageMetadataStatus.Ready,
      warningCodes: [],
    };
    const plan = {
      schemaVersion: CreatorImageProcessingPlanSchemaVersion.V1,
      id: 'plan-1',
      projectId: workspace.currentProjectId,
      source: { sourceKind: CreatorImageProcessingSourceKind.CreatorAsset, assetId: 'source-asset' },
      inputItems: [],
      presetId: null,
      operations: [{ id: 'convert-webp', operation: CreatorImageProcessingOperation.Convert, params: { format: CreatorImageProcessingOutputFormat.Webp } }],
      output: { format: CreatorImageProcessingOutputFormat.Webp, quality: 80, outputDirectory: tempDir, fileNamePattern: '{name}.webp', overwrite: false as const },
      outputItems: [],
      warnings: [],
      estimatedRisk: CreatorImageProcessingRisk.Low,
      createdBy: CreatorImageProcessingCreatedBy.User,
      status: CreatorImageProcessingPlanStatus.Ready,
      createdAt: 2,
      updatedAt: 2,
    };
    const job = {
      id: 'job-1',
      projectId: workspace.currentProjectId,
      planId: plan.id,
      status: CreatorImageProcessingJobStatus.Completed,
      totalCount: 1,
      successCount: 1,
      failedCount: 0,
      inputTotalSize: 10,
      outputTotalSize: 6,
      savedSize: 4,
      savedPercentage: 40,
      runtimeMetrics: null,
      reportAssetId: null,
      reportPath: null,
      createdAt: 2,
      startedAt: 2,
      completedAt: 3,
    };
    const task = {
      id: 'task-1',
      jobId: job.id,
      projectId: workspace.currentProjectId,
      sourceAssetId: 'source-asset',
      outputAssetId: null,
      sourceArtifactId: null,
      sourcePath,
      outputPath,
      status: CreatorImageProcessingTaskStatus.Completed,
      inputSize: 10,
      outputSize: 6,
      durationMs: 1,
      errorCode: null,
      errorMessage: null,
      createdAt: 2,
      updatedAt: 3,
      completedAt: 3,
    };

    const derived = store.createImageProcessingAsset({
      sourceAssetId: 'source-asset',
      outputPath,
      fileName: 'source.web-optimized.100x80.webp',
      mimeType: 'image/webp',
      imageMetadata,
      plan,
      job,
      task,
    });

    expect(derived.kind).toBe(CreatorProductionAssetKind.Image);
    expect(derived.source).toBe(CreatorProductionAssetSource.LocalImageProcessing);
    expect(derived.variantOfAssetId).toBe('source-asset');
    expect(derived.templateId).toBe('poster-system');
    expect(derived.caseIds).toEqual(['case-1']);
    expect(derived.promptText).toBe('Generate source.');
    expect(derived.licenseNote).toBe('license');
    expect(derived.usageNote).toBe('usage');
    expect(derived.imageMetadata?.format).toBe(CreatorImageProcessingOutputFormat.Webp);
    expect(store.getAssetSource(derived.id)?.sourceAsset?.id).toBe('source-asset');

    const row = db.prepare('SELECT metadata FROM production_assets WHERE id = ?').get(derived.id) as { metadata: string };
    const metadata = JSON.parse(row.metadata) as { processing?: { sourceAssetId?: string; plan?: { id?: string } } };
    expect(metadata.processing?.sourceAssetId).toBe('source-asset');
    expect(metadata.processing?.plan?.id).toBe('plan-1');
  });

  test('executes README banner pack recipe without modifying README files', async () => {
    const sharp = (await import('sharp')).default;
    const workspace = store.createProject({ name: 'Recipe Image Project' });
    const inputPath = path.join(tempDir, 'hero.png');
    const readmePath = path.join(tempDir, 'README.md');
    fs.writeFileSync(readmePath, '# Existing README\n');
    await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 4,
        background: '#224466',
      },
    }).png().toFile(inputPath);

    db.prepare(`
      INSERT INTO production_assets (
        id, project_id, kind, title, status, source, run_id, source_run_id, variant_of_asset_id,
        session_id, source_session_id, message_id, source_message_id, template_id, case_ids, case_ids_json,
        prompt_spec, prompt_spec_json, prompt_text, parent_prompt_asset_id, prompt_version_id, recipe_id,
        selected_direction_id, file_path, file_name, mime_type, favorite, adoption_status, tags_json,
        license_note, usage_note, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'hero-asset',
      workspace.currentProjectId,
      CreatorProductionAssetKind.Image,
      'Hero',
      CreatorProductionAssetStatus.Ready,
      CreatorProductionAssetSource.CoworkGeneratedImage,
      null,
      null,
      null,
      'session-1',
      'session-1',
      'message-1',
      'message-1',
      'readme-template',
      JSON.stringify(['case-readme']),
      JSON.stringify(['case-readme']),
      JSON.stringify({ schemaVersion: CreatorPromptSpecSchemaVersion.V1, subject: 'Hero' }),
      JSON.stringify({ schemaVersion: CreatorPromptSpecSchemaVersion.V1, subject: 'Hero' }),
      'Generate a project hero.',
      null,
      null,
      null,
      null,
      inputPath,
      path.basename(inputPath),
      'image/png',
      0,
      CreatorAssetAdoptionStatus.Unset,
      JSON.stringify(['hero']),
      'Owned by project',
      'README only',
      JSON.stringify({}),
      1,
      1,
    );

    const defaultOutput = {
      schemaVersion: CreatorRecipeOutputSchemaVersion.ImageProcessingV1,
      kind: CreatorRecipeOutputKind.ImageProcessing,
      packKind: CreatorRecipeImageProcessingPackKind.ReadmeBannerPack,
      rules: [{
        id: 'readme-banner-webp',
        title: 'README banner WebP',
        presetId: CreatorImageProcessingPresetId.ReadmeBanner,
        outputFormat: CreatorImageProcessingOutputFormat.Webp,
        outputDirectory: path.join(tempDir, 'recipe-output'),
        fileNamePattern: '{name}.readme-banner.{format}',
      }],
      report: { enabled: true },
      readmeSuggestion: {
        enabled: true,
        note: 'Suggest README usage only.',
      },
    };
    expect(parseCreatorRecipeImageProcessingOutput(defaultOutput)?.packKind)
      .toBe(CreatorRecipeImageProcessingPackKind.ReadmeBannerPack);

    const recipe = store.createRecipe({
      projectId: workspace.currentProjectId,
      title: 'README Banner Pack',
      promptSpec: { schemaVersion: CreatorPromptSpecSchemaVersion.V1, subject: 'Hero' },
      defaultOutput,
      tags: ['readme'],
    });
    const result = await store.executeImageProcessingRecipe({
      recipeId: recipe.id,
      assetId: 'hero-asset',
    });

    expect(fs.readFileSync(readmePath, 'utf8')).toBe('# Existing README\n');
    expect(result.plan.createdBy).toBe(CreatorImageProcessingCreatedBy.Recipe);
    expect(result.plan.recipeId).toBe(recipe.id);
    expect(result.plan.presetId).toBe(CreatorImageProcessingPresetId.ReadmeBanner);
    expect(result.plan.readmeSuggestions?.[0]?.markdown).toContain('![README banner]');
    expect(result.outputAssetIds).toHaveLength(1);

    const outputAsset = store.getAsset(result.outputAssetIds[0]);
    expect(outputAsset?.source).toBe(CreatorProductionAssetSource.RecipePostProcessing);
    expect(outputAsset?.recipeId).toBe(recipe.id);
    expect(outputAsset?.variantOfAssetId).toBe('hero-asset');
    expect(outputAsset?.licenseNote).toBe('Owned by project');
    expect(outputAsset?.usageNote).toBe('README only');
    expect(outputAsset?.imageMetadata?.format).toBe(CreatorImageProcessingOutputFormat.Webp);
    expect(outputAsset?.imageProcessing?.recipeId).toBe(recipe.id);
    expect(outputAsset?.imageProcessing?.readmeSuggestions?.[0]?.markdown).toContain('![README banner]');
    expect(outputAsset?.filePath.endsWith('.webp')).toBe(true);

    const job = store.getImageProcessingJob(result.job.id);
    expect(job?.job.reportAssetId).toBeTruthy();
    const reportAsset = job?.job.reportAssetId ? store.getAsset(job.job.reportAssetId) : null;
    expect(reportAsset?.kind).toBe(CreatorProductionAssetKind.Report);
    expect(reportAsset?.recipeId).toBe(recipe.id);
    expect(reportAsset?.imageProcessing?.tasks?.[0]?.outputAssetId).toBe(outputAsset?.id);
    expect(reportAsset?.imageProcessing?.readmeSuggestions?.[0]?.markdown).toContain('![README banner]');
    expect(reportAsset?.filePath.endsWith('-report.md')).toBe(true);
  });

  test('creates image processing batch job and keeps failed tasks isolated', async () => {
    const sharp = (await import('sharp')).default;
    const workspace = store.createProject({ name: 'Image Batch Project' });
    const goodPathA = path.join(tempDir, 'batch-a.png');
    const goodPathB = path.join(tempDir, 'batch-b.png');
    const brokenPath = path.join(tempDir, 'batch-broken.png');
    await sharp({
      create: {
        width: 40,
        height: 30,
        channels: 3,
        background: '#336699',
      },
    }).png().toFile(goodPathA);
    await sharp({
      create: {
        width: 50,
        height: 40,
        channels: 3,
        background: '#996633',
      },
    }).png().toFile(goodPathB);
    fs.writeFileSync(brokenPath, 'not an image');

    const insertAsset = (id: string, filePath: string) => {
      db.prepare(`
        INSERT INTO production_assets (
          id, project_id, kind, title, status, source, run_id, source_run_id, variant_of_asset_id,
          session_id, source_session_id, message_id, source_message_id, template_id, case_ids, case_ids_json,
          prompt_spec, prompt_spec_json, prompt_text, parent_prompt_asset_id, prompt_version_id, recipe_id,
          selected_direction_id, file_path, file_name, mime_type, favorite, adoption_status, tags_json,
          license_note, usage_note, metadata, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        workspace.currentProjectId,
        CreatorProductionAssetKind.Image,
        id,
        CreatorProductionAssetStatus.Ready,
        CreatorProductionAssetSource.CoworkGeneratedImage,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        JSON.stringify([]),
        JSON.stringify([]),
        null,
        null,
        '',
        null,
        null,
        null,
        null,
        filePath,
        path.basename(filePath),
        'image/png',
        0,
        CreatorAssetAdoptionStatus.Unset,
        JSON.stringify([]),
        null,
        null,
        JSON.stringify({}),
        1,
        1,
      );
    };

    insertAsset('image-a', goodPathA);
    insertAsset('image-b', goodPathB);
    insertAsset('image-broken', brokenPath);

    const result = await store.createImageProcessingBatchJob({
      projectId: workspace.currentProjectId,
      assetIds: ['image-a', 'image-b', 'image-broken'],
      outputFormat: CreatorImageProcessingOutputFormat.Webp,
      maxWidth: 32,
      maxHeight: 32,
    });

    expect(result.job.status).toBe(CreatorImageProcessingJobStatus.PartialFailed);
    expect(result.job.successCount).toBe(2);
    expect(result.job.failedCount).toBe(1);
    expect(result.job.runtimeMetrics?.backend).toBe('sharp');
    expect(result.job.runtimeMetrics?.imageCount).toBe(3);
    expect(result.job.savedPercentage).toBeGreaterThanOrEqual(0);
    expect(result.job.reportAssetId).toBeTruthy();
    expect(result.tasks.filter((task) => task.status === CreatorImageProcessingTaskStatus.Completed)).toHaveLength(2);
    expect(result.tasks.filter((task) => task.status === CreatorImageProcessingTaskStatus.Failed)).toHaveLength(1);
    expect(result.outputAssetIds).toHaveLength(2);

    const listed = store.listImageProcessingJobs({ projectId: workspace.currentProjectId });
    expect(listed.total).toBe(1);
    expect(listed.jobs[0].tasks).toHaveLength(3);
    const derivedAssets = store.listAssets({
      projectId: workspace.currentProjectId,
      source: CreatorProductionAssetSource.LocalImageProcessing,
    });
    expect(derivedAssets.total).toBe(2);
    expect(derivedAssets.assets[0].variantOfAssetId).toBeTruthy();
    const reportAsset = store.getAsset(result.job.reportAssetId!);
    expect(reportAsset?.kind).toBe(CreatorProductionAssetKind.Report);
    expect(reportAsset?.source).toBe(CreatorProductionAssetSource.ImageProcessingReport);
    expect(reportAsset?.variantOfAssetId).toBeTruthy();
    expect(fs.existsSync(reportAsset!.filePath)).toBe(true);
    const reportMarkdown = fs.readFileSync(reportAsset!.filePath, 'utf8');
    expect(reportMarkdown).toContain('Success / failed: 2 / 1');
    expect(reportMarkdown).toContain('Output directory:');
    expect(reportMarkdown).not.toMatch(/base64,/i);
    const reportRow = db.prepare('SELECT metadata FROM production_assets WHERE id = ?').get(reportAsset!.id) as { metadata: string };
    const reportMetadata = JSON.parse(reportRow.metadata) as { imageProcessingReport?: { metrics?: { backend?: string }; failureReasons?: unknown[] } };
    expect(reportMetadata.imageProcessingReport?.metrics?.backend).toBe('sharp');
    expect(reportMetadata.imageProcessingReport?.failureReasons).toHaveLength(1);

    const failedTask = result.tasks.find((task) => task.status === CreatorImageProcessingTaskStatus.Failed);
    expect(failedTask).toBeTruthy();
    const retry = await store.retryImageProcessingTask(failedTask!.id);
    expect(retry?.tasks.find((task) => task.id === failedTask!.id)?.status).toBe(CreatorImageProcessingTaskStatus.Failed);
  });

  test('cancels pending image processing task', () => {
    const workspace = store.createProject({ name: 'Cancel Image Batch Project' });
    const now = Date.now();
    db.prepare(`
      INSERT INTO creator_image_processing_plans (
        id, project_id, source_json, plan_json, status, preset_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'plan-cancel',
      workspace.currentProjectId,
      JSON.stringify({ sourceKind: CreatorImageProcessingSourceKind.CreatorAsset }),
      JSON.stringify({
        id: 'plan-cancel',
        projectId: workspace.currentProjectId,
        source: { sourceKind: CreatorImageProcessingSourceKind.CreatorAsset },
        inputItems: [],
        outputItems: [],
      }),
      CreatorImageProcessingPlanStatus.Ready,
      null,
      CreatorImageProcessingCreatedBy.User,
      now,
      now,
    );
    db.prepare(`
      INSERT INTO creator_image_processing_jobs (
        id, project_id, plan_id, status, total_count, success_count, failed_count,
        input_total_size, output_total_size, saved_size, report_asset_id, metadata_json, created_at, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'job-cancel',
      workspace.currentProjectId,
      'plan-cancel',
      CreatorImageProcessingJobStatus.Running,
      1,
      0,
      0,
      100,
      0,
      0,
      null,
      JSON.stringify({}),
      now,
      now,
      null,
    );
    db.prepare(`
      INSERT INTO creator_image_processing_tasks (
        id, job_id, project_id, source_asset_id, output_asset_id, source_artifact_id,
        source_path, output_path, status, input_size, output_size, duration_ms,
        error_code, error_message, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'task-cancel',
      'job-cancel',
      workspace.currentProjectId,
      'source-asset',
      null,
      null,
      '/tmp/source.png',
      '/tmp/output.webp',
      CreatorImageProcessingTaskStatus.Pending,
      100,
      null,
      null,
      null,
      null,
      now,
      now,
      null,
    );

    const result = store.cancelImageProcessingTask('task-cancel');

    expect(result?.tasks[0].status).toBe(CreatorImageProcessingTaskStatus.Canceled);
    expect(result?.job.status).toBe(CreatorImageProcessingJobStatus.Canceled);
  });
});
