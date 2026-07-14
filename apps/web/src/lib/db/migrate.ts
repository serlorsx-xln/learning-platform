import { db } from "./index";
import { sql } from "drizzle-orm";

export function runMigrations() {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      role TEXT NOT NULL DEFAULT 'operator',
      banned INTEGER DEFAULT 0,
      ban_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      config_json TEXT NOT NULL DEFAULT '{}',
      credentials_enc TEXT NOT NULL,
      account_label TEXT NOT NULL,
      summary_json TEXT,
      created_by TEXT NOT NULL REFERENCES user(id),
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS jobs_platform_idx ON jobs(platform)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status)
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS job_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      payload_json TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS job_events_job_id_idx ON job_events(job_id)
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL REFERENCES user(id),
      actor_name TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON audit_logs(actor_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action)
  `);
}

if (require.main === module) {
  runMigrations();
  console.log("Migrations complete.");
}
