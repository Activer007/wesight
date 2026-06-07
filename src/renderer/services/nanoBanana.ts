import type {
  NanoBananaImportRecordInput,
  NanoBananaPrompt,
  NanoBananaPromptConvertResult,
  NanoBananaPromptGetInput,
  NanoBananaPromptImportRecord,
  NanoBananaPromptIndexItem,
  NanoBananaPromptSource,
  NanoBananaSearchInput,
  NanoBananaSearchResult,
  NanoBananaSourceStatusSnapshot,
  NanoBananaSyncInput,
  NanoBananaSyncResult,
  NanoBananaUsageEventRecord,
  NanoBananaUsageRecordInput,
} from '@shared/nanoBanana/types';

class NanoBananaService {
  async listSources(): Promise<NanoBananaPromptSource[]> {
    const result = await window.electron.nanoBanana.listSources();
    if (!result.success) {
      throw new Error(result.error || 'Failed to list Nano sources');
    }
    return result.sources ?? [];
  }

  async getSourceStatus(sourceId?: string): Promise<NanoBananaSourceStatusSnapshot | null> {
    const result = await window.electron.nanoBanana.getSourceStatus(sourceId ? { sourceId } : undefined);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get Nano source status');
    }
    return result.status ?? null;
  }

  async sync(input: NanoBananaSyncInput = {}): Promise<NanoBananaSyncResult> {
    const result = await window.electron.nanoBanana.sync(input);
    if (!result.success || !result.result) {
      throw new Error(result.error || 'Failed to sync Nano prompts');
    }
    return result.result;
  }

  async search(input: NanoBananaSearchInput = {}): Promise<NanoBananaSearchResult> {
    const result = await window.electron.nanoBanana.search(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to search Nano prompts');
    }
    return {
      items: result.items ?? [],
      totalItems: result.totalItems ?? 0,
      limit: result.limit ?? input.limit ?? 30,
      offset: result.offset ?? input.offset ?? 0,
    };
  }

  async getPrompt(input: NanoBananaPromptGetInput): Promise<{
    prompt: NanoBananaPrompt | null;
    indexItem?: NanoBananaPromptIndexItem | null;
    warnings: string[];
  }> {
    const result = await window.electron.nanoBanana.getPrompt(input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get Nano prompt');
    }
    return {
      prompt: result.prompt ?? null,
      indexItem: result.indexItem ?? null,
      warnings: result.warnings ?? [],
    };
  }

  async convertPrompt(input: NanoBananaPromptGetInput): Promise<NanoBananaPromptConvertResult> {
    const result = await window.electron.nanoBanana.convertPrompt(input);
    if (!result.success || !result.promptSpec || !result.promptId || !result.sourceId || !result.sourcePromptId) {
      throw new Error(result.error || 'Failed to convert Nano prompt');
    }
    return {
      sourceId: result.sourceId,
      promptId: result.promptId,
      sourcePromptId: result.sourcePromptId,
      promptSpec: result.promptSpec,
      warnings: result.warnings ?? [],
    };
  }

  async recordUsage(input: NanoBananaUsageRecordInput): Promise<NanoBananaUsageEventRecord> {
    const result = await window.electron.nanoBanana.recordUsage(input);
    if (!result.success || !result.record) {
      throw new Error(result.error || 'Failed to record Nano usage');
    }
    return result.record;
  }

  async recordImport(input: NanoBananaImportRecordInput): Promise<NanoBananaPromptImportRecord> {
    const result = await window.electron.nanoBanana.recordImport(input);
    if (!result.success || !result.record) {
      throw new Error(result.error || 'Failed to record Nano import');
    }
    return result.record;
  }
}

export const nanoBananaService = new NanoBananaService();
