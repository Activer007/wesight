import type Database from 'better-sqlite3';

export const ensureCreatorImageProcessingSchema = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS creator_image_processing_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_json TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      status TEXT NOT NULL,
      preset_id TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_creator_image_processing_plans_project_created
    ON creator_image_processing_plans(project_id, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS creator_image_processing_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      input_total_size INTEGER NOT NULL DEFAULT 0,
      output_total_size INTEGER NOT NULL DEFAULT 0,
      saved_size INTEGER NOT NULL DEFAULT 0,
      report_asset_id TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      FOREIGN KEY (plan_id) REFERENCES creator_image_processing_plans(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_creator_image_processing_jobs_project_created
    ON creator_image_processing_jobs(project_id, created_at DESC);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_creator_image_processing_jobs_status
    ON creator_image_processing_jobs(status);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS creator_image_processing_tasks (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      source_asset_id TEXT,
      output_asset_id TEXT,
      source_artifact_id TEXT,
      source_path TEXT NOT NULL,
      output_path TEXT,
      status TEXT NOT NULL,
      input_size INTEGER,
      output_size INTEGER,
      duration_ms INTEGER,
      error_code TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (job_id) REFERENCES creator_image_processing_jobs(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_creator_image_processing_tasks_job
    ON creator_image_processing_tasks(job_id, created_at);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_creator_image_processing_tasks_status
    ON creator_image_processing_tasks(status);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_creator_image_processing_tasks_source_asset
    ON creator_image_processing_tasks(source_asset_id);
  `);
};
