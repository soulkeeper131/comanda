import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(path.join(dbDir, "sqlite.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Auto-create tables on first run
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, settings TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id),
    email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'worker', full_name TEXT,
    phone TEXT, active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL, address TEXT,
    lat REAL NOT NULL, lng REAL NOT NULL,
    geofence_m INTEGER DEFAULT 75,
    kind TEXT DEFAULT 'apartment', access_notes TEXT,
    archived INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS zones (
    id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id),
    property_id TEXT NOT NULL REFERENCES properties(id),
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS service_templates (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL, description TEXT,
    base_price REAL, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS template_items (
    id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES service_templates(id),
    zone_label TEXT, label TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
    required INTEGER DEFAULT 1,
    evidence_type TEXT DEFAULT 'note'
  );
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id),
    name TEXT, price REAL, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
    property_id TEXT NOT NULL REFERENCES properties(id),
    plan_id TEXT REFERENCES plans(id),
    template_id TEXT REFERENCES service_templates(id),
    assignee_id TEXT REFERENCES users(id),
    title TEXT, duration_min INTEGER,
    planned_at TEXT NOT NULL,
    status TEXT DEFAULT 'planned',
    property_name TEXT,
    check_in TEXT, check_out TEXT,
    note TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS job_items (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
    zone_label TEXT, label TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    evidence_type TEXT DEFAULT 'note',
    required INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
    job_item_id TEXT REFERENCES job_items(id),
    storage_path TEXT NOT NULL,
    taken_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id),
    property_id TEXT NOT NULL REFERENCES properties(id),
    job_id TEXT REFERENCES jobs(id),
    job_item_id TEXT REFERENCES job_items(id),
    reported_by TEXT REFERENCES users(id),
    title TEXT NOT NULL, body TEXT,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS finding_photos (
    id TEXT PRIMARY KEY, finding_id TEXT NOT NULL REFERENCES findings(id),
    storage_path TEXT NOT NULL,
    taken_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY, finding_id TEXT NOT NULL REFERENCES findings(id),
    price REAL, days INTEGER, scope TEXT,
    decision TEXT DEFAULT 'pending',
    sent_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id),
    name TEXT, email TEXT, phone TEXT, message TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migration: add missing columns to existing tables (CREATE TABLE IF NOT EXISTS won't add them)
const migrate = (table: string, col: string, type: string) => {
  try { sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
};
migrate("jobs", "property_name", "TEXT");
migrate("findings", "job_item_id", "TEXT REFERENCES job_items(id)");
migrate("findings", "reported_by", "TEXT REFERENCES users(id)");
migrate("findings", "body", "TEXT");

export const db = drizzle(sqlite, { schema });
