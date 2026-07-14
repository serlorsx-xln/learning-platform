import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/platform.db";
const dbPath = databaseUrl.replace(/^file:/, "");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

const statements = [
  `CREATE TABLE IF NOT EXISTS user (
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
  )`,
  `CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS account (
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
  )`,
];

for (const sql of statements) {
  db.exec(sql);
}

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (email && password) {
  const now = Date.now();
  const hashed = await hashPassword(password);
  let user = db.prepare("SELECT id FROM user WHERE email = ?").get(email);

  if (!user) {
    const admin = db.prepare("SELECT id FROM user WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      db.prepare(
        "UPDATE user SET email = ?, name = 'Admin', role = 'admin', banned = 0, updated_at = ? WHERE id = ?",
      ).run(email, now, admin.id);
      user = admin;
      console.log(`Bootstrap admin migrated to: ${email}`);
    } else {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO user (id, name, email, email_verified, role, banned, created_at, updated_at)
         VALUES (?, 'Admin', ?, 0, 'admin', 0, ?, ?)`,
      ).run(id, email, now, now);
      user = { id };
      console.log(`Bootstrap admin created: ${email}`);
    }
  } else {
    db.prepare(
      "UPDATE user SET role = 'admin', banned = 0, updated_at = ? WHERE id = ?",
    ).run(now, user.id);
    console.log(`Bootstrap admin synced: ${email}`);
  }

  const account = db
    .prepare("SELECT id FROM account WHERE user_id = ? AND provider_id = 'credential'")
    .get(user.id);

  if (account) {
    db.prepare(
      "UPDATE account SET password = ?, account_id = ?, updated_at = ? WHERE id = ?",
    ).run(hashed, email, now, account.id);
  } else {
    db.prepare(
      `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
       VALUES (?, ?, 'credential', ?, ?, ?, ?)`,
    ).run(randomUUID(), email, user.id, hashed, now, now);
  }
} else {
  console.warn("Bootstrap admin skipped: BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set");
}

db.close();

const child = spawn("node", ["server.js"], { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
