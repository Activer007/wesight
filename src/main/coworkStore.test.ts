/**
 * Unit tests for CoworkStore – resilient metadata parsing.
 *
 * Verifies that corrupt JSON in the metadata column of cowork_messages does NOT
 * prevent a session from loading.  Valid/null metadata must still work correctly.
 *
 * Mocks the `electron` module so CoworkStore can be imported outside Electron.
 */
import fs from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { beforeEach, expect, test, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock electron so the import of coworkStore.ts succeeds in Node
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock' },
}));

// ---------------------------------------------------------------------------
// Now import the class under test
// ---------------------------------------------------------------------------
import BetterSqlite3 from 'better-sqlite3';

import { CoworkImageToolName, ExternalAgentConfigSource } from '../shared/cowork/constants';
import {
  CreatorAssetAdoptionStatus,
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
} from '../shared/creatorStudio/constants';
import { CoworkStore } from './coworkStore';
import { CreatorAssetStore } from './creatorAssetStore';
import { ensureCreatorImageProcessingSchema } from './creatorImageProcessingSchema';
import { ensureCreatorProductionSchema } from './creatorProductionSchema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let db: BetterSqlite3.Database;
let store: CoworkStore;
let creatorAssetStore: CreatorAssetStore;

/** Initialise a fresh in-memory database with the minimum schema. */
function setupDb(): void {
  db = new BetterSqlite3(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cowork_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      claude_session_id TEXT,
      codex_app_thread_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      pinned INTEGER NOT NULL DEFAULT 0,
      cwd TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      execution_mode TEXT NOT NULL DEFAULT 'local',
      active_skill_ids TEXT,
      runtime_snapshot_json TEXT,
      agent_id TEXT NOT NULL DEFAULT 'main',
      session_kind TEXT NOT NULL DEFAULT 'single',
      parent_session_id TEXT,
      team_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cowork_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      sequence INTEGER,
      FOREIGN KEY (session_id) REFERENCES cowork_sessions(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cowork_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cowork_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_event_id TEXT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cowork_events_source_event
    ON cowork_events(source, source_event_id)
    WHERE source_event_id IS NOT NULL;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cowork_user_memories (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      fingerprint TEXT NOT NULL DEFAULT '',
      confidence REAL NOT NULL DEFAULT 0.5,
      is_explicit INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );
  `);

  // CoworkStore only needs (db)
  ensureCreatorProductionSchema(db);
  ensureCreatorImageProcessingSchema(db);
  store = new CoworkStore(db);
  creatorAssetStore = new CreatorAssetStore(db);
  store.setCreatorAssetStore(creatorAssetStore);
}

/** Insert a session row directly. */
function insertSession(id: string): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO cowork_sessions (id, title, claude_session_id, codex_app_thread_id, status, pinned, cwd, system_prompt, execution_mode, active_skill_ids, agent_id, session_kind, parent_session_id, team_id, created_at, updated_at)
     VALUES (?, 'test', NULL, NULL, 'idle', 0, '/tmp', '', 'local', '[]', 'main', 'single', NULL, NULL, ?, ?)`,
  ).run(id, now, now);
}

function insertImageAsset(input: { id: string; sessionId: string; filePath: string; projectId?: string }): void {
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
    input.id,
    input.projectId ?? 'project-1',
    CreatorProductionAssetKind.Image,
    input.id,
    CreatorProductionAssetStatus.Ready,
    CreatorProductionAssetSource.CoworkGeneratedImage,
    null,
    null,
    null,
    input.sessionId,
    input.sessionId,
    'message-1',
    'message-1',
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
    input.filePath,
    'image.png',
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
}

/** Insert a message row directly, bypassing CoworkStore.addMessage. */
function insertMessage(
  id: string,
  sessionId: string,
  type: string,
  content: string,
  metadata: string | null,
  sequence: number,
): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, sessionId, type, content, metadata, now, sequence);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  setupDb();
});

test('defaults Codex CLI to local config source', () => {
  expect(store.getConfig().codexConfigSource).toBe(ExternalAgentConfigSource.LocalCli);
});

test('getSession returns all messages when one has corrupt metadata', () => {
  const sid = 'sess-1';
  insertSession(sid);

  insertMessage('msg-valid', sid, 'user', 'hello', '{"key":"value"}', 1);
  insertMessage('msg-corrupt', sid, 'tool_use', 'do something', '{broken', 2);
  insertMessage('msg-null', sid, 'assistant', 'reply', null, 3);

  const session = store.getSession(sid);
  expect(session).not.toBeNull();
  expect(session!.messages).toHaveLength(3);

  // Valid metadata preserved
  const validMsg = session!.messages.find((m) => m.id === 'msg-valid')!;
  expect(validMsg.metadata).toEqual({ key: 'value' });

  // Corrupt metadata discarded
  const corruptMsg = session!.messages.find((m) => m.id === 'msg-corrupt')!;
  expect(corruptMsg.metadata).toBeUndefined();
  expect(corruptMsg.content).toBe('do something');
  expect(corruptMsg.type).toBe('tool_use');

  // Null metadata → undefined
  const nullMsg = session!.messages.find((m) => m.id === 'msg-null')!;
  expect(nullMsg.metadata).toBeUndefined();
});

test('getSession returns all messages when ALL have corrupt metadata', () => {
  const sid = 'sess-2';
  insertSession(sid);

  insertMessage('m1', sid, 'user', 'one', '{bad1', 1);
  insertMessage('m2', sid, 'assistant', 'two', '{{bad2', 2);
  insertMessage('m3', sid, 'tool_use', 'three', 'not json at all', 3);

  const session = store.getSession(sid);
  expect(session).not.toBeNull();
  expect(session!.messages).toHaveLength(3);

  for (const msg of session!.messages) {
    expect(msg.metadata).toBeUndefined();
    expect(msg.id).toBeTruthy();
    expect(msg.content).toBeTruthy();
  }
});

test('console.warn is called exactly once for single corrupt metadata row', () => {
  const sid = 'sess-3';
  insertSession(sid);

  insertMessage('msg-ok', sid, 'user', 'hi', '{"a":1}', 1);
  insertMessage('msg-bad', sid, 'tool_use', 'oops', '{broken', 2);
  insertMessage('msg-nil', sid, 'assistant', 'reply', null, 3);

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  store.getSession(sid);

  expect(warnSpy).toHaveBeenCalledTimes(1);

  const warnMessage = warnSpy.mock.calls[0][0] as string;
  expect(warnMessage).toContain('[CoworkStore]');
  expect(warnMessage).toContain('msg-bad');
  expect(warnMessage).toContain(sid);

  warnSpy.mockRestore();
});

test('no console.warn when all metadata is valid or null', () => {
  const sid = 'sess-4';
  insertSession(sid);

  insertMessage('m1', sid, 'user', 'hi', '{"ok":true}', 1);
  insertMessage('m2', sid, 'assistant', 'reply', null, 2);

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  store.getSession(sid);

  expect(warnSpy).not.toHaveBeenCalled();

  warnSpy.mockRestore();
});

test('reads session metadata and paged messages without loading the full session', () => {
  const sid = 'sess-paged';
  insertSession(sid);

  for (let index = 1; index <= 5; index += 1) {
    insertMessage(`m${index}`, sid, 'assistant', `message ${index}`, null, index);
  }

  const meta = store.getSessionMeta(sid);
  expect(meta).not.toBeNull();
  expect(meta!.id).toBe(sid);

  expect(store.getRecentMessages(sid, 2).map((message) => message.id)).toEqual(['m4', 'm5']);
  expect(store.getMessagesBefore(sid, 4, 2).map((message) => message.id)).toEqual(['m2', 'm3']);
  expect(store.getMessagesAfter(sid, 3).map((message) => message.id)).toEqual(['m4', 'm5']);
});

test('addMessage assigns increasing sequences and stores config updates transactionally', () => {
  const sid = 'sess-write';
  insertSession(sid);

  const first = store.addMessage(sid, { type: 'user', content: 'first' });
  const second = store.addMessage(sid, { type: 'assistant', content: 'second' });

  expect(first.sequence).toBe(1);
  expect(second.sequence).toBe(2);
  expect(store.getRecentMessages(sid, 10).map((message) => message.sequence)).toEqual([1, 2]);

  store.setConfig({
    workingDirectory: '/tmp/work',
    memoryEnabled: false,
    memoryUserMemoriesMaxItems: 4,
  });

  const rows = db
    .prepare('SELECT key, value FROM cowork_config ORDER BY key')
    .all() as Array<{ key: string; value: string }>;
  expect(rows).toEqual([
    { key: 'memoryEnabled', value: '0' },
    { key: 'memoryUserMemoriesMaxItems', value: '4' },
    { key: 'workingDirectory', value: '/tmp/work' },
  ]);
});

test('cowork image plan tool saves a plan without executing output files', async () => {
  const sharp = (await import('sharp')).default;
  insertSession('session-image-plan');
  const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'wesight-cowork-image-tool-'));
  const sourcePath = path.join(tempDir, 'source.png');
  await sharp({
    create: {
      width: 80,
      height: 40,
      channels: 3,
      background: '#336699',
    },
  }).png().toFile(sourcePath);
  insertImageAsset({ id: 'image-tool-asset', sessionId: 'session-image-plan', filePath: sourcePath });

  const result = await store.runCoworkImageTool('session-image-plan', CoworkImageToolName.PlanProcessing, {
    assetId: 'image-tool-asset',
    presetId: CreatorImageProcessingPresetId.ReadmeBanner,
    outputFormat: CreatorImageProcessingOutputFormat.Webp,
  });

  expect(result.isError).toBeFalsy();
  expect(result.text).toContain('Created image processing plan');
  const messages = store.getRecentMessages('session-image-plan', 10);
  const planMessage = messages.find((message) => message.metadata?.kind === 'image_processing_plan');
  expect(planMessage?.metadata?.requiresUserConfirmation).toBe(true);
  const plan = planMessage?.metadata?.imageProcessingPlan as { id?: string; outputItems?: Array<{ outputPath: string }> } | undefined;
  expect(plan?.id).toBeTruthy();
  expect(creatorAssetStore.getImageProcessingPlan(plan!.id!)).toBeTruthy();
  expect(fs.existsSync(plan!.outputItems![0].outputPath)).toBe(false);
});

test('cowork image execute tool requires confirmation and does not execute', async () => {
  insertSession('session-image-execute');

  const result = await store.runCoworkImageTool('session-image-execute', CoworkImageToolName.ExecuteProcessing, {
    planId: 'plan-needs-confirm',
  });

  expect(result.isError).toBeFalsy();
  expect(result.text).toContain('cannot execute it without user confirmation');
  const message = store.getRecentMessages('session-image-execute', 10).find((item) => item.metadata?.kind === 'image_processing_execute_request');
  expect(message?.metadata?.imageProcessingPlanId).toBe('plan-needs-confirm');
  expect(message?.metadata?.requiresUserConfirmation).toBe(true);
});

test('records cowork image processing execution result metadata after confirmation', () => {
  insertSession('session-image-result');
  const plan = {
    schemaVersion: CreatorImageProcessingPlanSchemaVersion.V1,
    id: 'plan-confirmed',
    projectId: 'project-1',
    source: { sourceKind: CreatorImageProcessingSourceKind.CreatorAsset, assetId: 'asset-source' },
    inputItems: [{
      id: 'input-asset-source',
      source: {
        sourceKind: CreatorImageProcessingSourceKind.CreatorAsset,
        assetId: 'asset-source',
        messageId: 'message-source',
      },
      sourceAssetId: 'asset-source',
      sourcePath: '/tmp/source.png',
      metadata: null,
    }],
    presetId: CreatorImageProcessingPresetId.ReadmeBanner,
    operations: [],
    output: {
      format: CreatorImageProcessingOutputFormat.Webp,
      quality: 82,
      outputDirectory: '/tmp/out',
      fileNamePattern: '{name}.webp',
      overwrite: false as const,
    },
    outputItems: [],
    warnings: [],
    estimatedRisk: CreatorImageProcessingRisk.Low,
    createdBy: 'agent' as const,
    status: CreatorImageProcessingPlanStatus.Ready,
    createdAt: 1,
    updatedAt: 1,
  };
  const job = {
    id: 'job-plan-confirmed',
    projectId: 'project-1',
    planId: plan.id,
    status: CreatorImageProcessingJobStatus.Completed,
    totalCount: 1,
    successCount: 1,
    failedCount: 0,
    inputTotalSize: 100,
    outputTotalSize: 40,
    savedSize: 60,
    savedPercentage: 60,
    runtimeMetrics: null,
    reportAssetId: 'report-asset',
    reportPath: '/tmp/out/report.md',
    createdAt: 1,
    startedAt: 1,
    completedAt: 2,
  };
  const tasks = [{
    id: 'task-1',
    jobId: job.id,
    projectId: 'project-1',
    sourceAssetId: 'asset-source',
    outputAssetId: 'asset-output',
    sourceArtifactId: null,
    sourcePath: '/tmp/source.png',
    outputPath: '/tmp/out/source.webp',
    status: CreatorImageProcessingTaskStatus.Completed,
    inputSize: 100,
    outputSize: 40,
    durationMs: 5,
    errorCode: null,
    errorMessage: null,
    createdAt: 1,
    updatedAt: 2,
    completedAt: 2,
  }];

  const message = store.recordImageProcessingExecutionResult({
    sessionId: 'session-image-result',
    plan,
    job,
    tasks,
    outputAssetIds: ['asset-output'],
    outputAssets: [{ id: 'asset-output', fileName: 'source.webp', mimeType: 'image/webp' }],
    planMessageId: 'message-plan',
  });

  expect(message.metadata?.kind).toBe('image_processing_result');
  expect(message.metadata?.imageProcessingPlanId).toBe('plan-confirmed');
  expect(message.metadata?.imageProcessingJobId).toBe('job-plan-confirmed');
  expect(message.metadata?.imageProcessingPlanMessageId).toBe('message-plan');
  expect(message.metadata?.imageProcessingResult).toMatchObject({
    planId: 'plan-confirmed',
    jobId: 'job-plan-confirmed',
    outputAssetIds: ['asset-output'],
    reportAssetId: 'report-asset',
  });
  const persisted = store.getRecentMessages('session-image-result', 5)
    .find((item) => item.metadata?.kind === 'image_processing_result');
  expect(persisted?.metadata?.imageProcessingResult).toMatchObject({
    successCount: 1,
    failedCount: 0,
  });
});

test('cowork image tool rejects disabled feature flag and unauthorized asset', async () => {
  insertSession('session-image-auth');
  insertSession('other-session');
  insertImageAsset({ id: 'other-image', sessionId: 'other-session', filePath: '/tmp/other.png' });

  const disabled = await store.runCoworkImageTool('session-image-auth', CoworkImageToolName.Inspect, {}, {
    featureEnabled: false,
  });
  expect(disabled.isError).toBe(true);
  expect(disabled.text).toContain('creator.imageProcessing.enabled');

  const unauthorized = await store.runCoworkImageTool('session-image-auth', CoworkImageToolName.PlanProcessing, {
    assetId: 'other-image',
  });
  expect(unauthorized.isError).toBe(true);
  expect(unauthorized.text).toContain('No controlled image asset');
});
