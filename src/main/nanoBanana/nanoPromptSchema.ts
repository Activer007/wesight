import type Database from 'better-sqlite3';

export const ensureNanoPromptSchema = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nano_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      source_type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_synced_at INTEGER,
      last_checked_at INTEGER,
      last_updated_remote TEXT,
      total_items INTEGER NOT NULL DEFAULT 0,
      total_pages INTEGER NOT NULL DEFAULT 0,
      items_per_page INTEGER NOT NULL DEFAULT 0,
      total_categories INTEGER NOT NULL DEFAULT 0,
      pre_rendered_pages INTEGER NOT NULL DEFAULT 0,
      etag_meta TEXT,
      etag_index TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      raw_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS nano_prompt_index_items (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_prompt_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      categories_json TEXT NOT NULL DEFAULT '[]',
      published_at TEXT,
      likes INTEGER NOT NULL DEFAULT 0,
      results_count INTEGER NOT NULL DEFAULT 0,
      page INTEGER NOT NULL,
      search_terms TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT,
      raw_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(source_id, source_prompt_id),
      FOREIGN KEY (source_id) REFERENCES nano_sources(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nano_prompt_index_items_source_page
    ON nano_prompt_index_items(source_id, page);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nano_prompt_index_items_source_published
    ON nano_prompt_index_items(source_id, published_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS nano_prompts (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_prompt_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      translated_content TEXT,
      source_link TEXT,
      source_platform TEXT,
      source_published_at TEXT,
      author_json TEXT NOT NULL DEFAULT '{}',
      media_json TEXT NOT NULL DEFAULT '[]',
      media_thumbnails_json TEXT NOT NULL DEFAULT '[]',
      language TEXT NOT NULL DEFAULT '',
      search_index TEXT NOT NULL DEFAULT '',
      likes INTEGER NOT NULL DEFAULT 0,
      results_count INTEGER NOT NULL DEFAULT 0,
      need_reference_images INTEGER NOT NULL DEFAULT 0,
      prompt_categories_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      tags_zh_json TEXT NOT NULL DEFAULT '[]',
      page INTEGER,
      raw_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(source_id, source_prompt_id),
      FOREIGN KEY (source_id) REFERENCES nano_sources(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nano_prompts_source_page
    ON nano_prompts(source_id, page);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS nano_prompt_pages (
      source_id TEXT NOT NULL,
      page INTEGER NOT NULL,
      total_pages INTEGER NOT NULL DEFAULT 0,
      total_items INTEGER NOT NULL DEFAULT 0,
      has_next INTEGER NOT NULL DEFAULT 0,
      has_prev INTEGER NOT NULL DEFAULT 0,
      item_count INTEGER NOT NULL DEFAULT 0,
      etag TEXT,
      raw_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(source_id, page),
      FOREIGN KEY (source_id) REFERENCES nano_sources(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS nano_prompt_imports (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      source_prompt_id TEXT NOT NULL,
      import_type TEXT NOT NULL,
      project_id TEXT,
      target_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES nano_sources(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nano_prompt_imports_prompt
    ON nano_prompt_imports(prompt_id, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS nano_prompt_usage_events (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      prompt_id TEXT,
      source_prompt_id TEXT,
      event_type TEXT NOT NULL,
      import_type TEXT,
      project_id TEXT,
      target_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES nano_sources(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nano_prompt_usage_events_prompt
    ON nano_prompt_usage_events(prompt_id, created_at DESC);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nano_prompt_usage_events_source_type
    ON nano_prompt_usage_events(source_id, event_type, created_at DESC);
  `);
};
