import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Create all tables that Drizzle manages but may not exist in SQLite
    db.run(sql`CREATE TABLE IF NOT EXISTS service_templates (
      id TEXT PRIMARY KEY, org_id TEXT, category TEXT NOT NULL,
      name TEXT NOT NULL, description TEXT, icon TEXT DEFAULT '🧹',
      duration_min INTEGER DEFAULT 60, price REAL DEFAULT 0,
      bookable INTEGER DEFAULT 1, archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS template_items (
      id TEXT PRIMARY KEY, template_id TEXT NOT NULL,
      zone_label TEXT, label TEXT NOT NULL,
      proof_type TEXT DEFAULT 'photo', required INTEGER DEFAULT 1,
      sort INTEGER DEFAULT 0
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY, property_id TEXT NOT NULL,
      template_id TEXT NOT NULL, name TEXT NOT NULL,
      per_month INTEGER DEFAULT 4, price REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      started_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, org_id TEXT, property_id TEXT NOT NULL,
      plan_id TEXT, template_id TEXT, assignee_id TEXT,
      title TEXT, duration_min INTEGER,
      planned_at TEXT NOT NULL, status TEXT DEFAULT 'planned',
      check_in TEXT, check_out TEXT, note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS job_items (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL,
      zone_label TEXT, label TEXT NOT NULL,
      proof_type TEXT DEFAULT 'photo', required INTEGER DEFAULT 1,
      sort INTEGER DEFAULT 0, done INTEGER DEFAULT 0,
      count_value INTEGER, note TEXT
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL,
      job_item_id TEXT, storage_path TEXT NOT NULL,
      taken_at TEXT DEFAULT (datetime('now')),
      lat REAL, lng REAL
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY, org_id TEXT, property_id TEXT NOT NULL,
      job_id TEXT, reported_by TEXT,
      title TEXT NOT NULL, body TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS finding_photos (
      id TEXT PRIMARY KEY, finding_id TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      taken_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY, finding_id TEXT NOT NULL,
      price REAL, days INTEGER, scope TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      decision TEXT DEFAULT 'pending'
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS zones (
      id TEXT PRIMARY KEY, property_id TEXT NOT NULL,
      name TEXT NOT NULL, sort INTEGER DEFAULT 0
    )`);

    db.run(sql`CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY, full_name TEXT NOT NULL,
      phone TEXT, email TEXT, city TEXT,
      property_kind TEXT, service TEXT, message TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    // Check counts
    const counts: Record<string, number> = {};
    for (const tbl of ['service_templates','template_items','jobs','job_items','evidence','findings','offers','zones','plans']) {
      try {
        const r = db.get(sql.raw(`SELECT COUNT(*) as c FROM ${tbl}`)) as any;
        counts[tbl] = r?.c ?? 0;
      } catch { counts[tbl] = -1; }
    }

    return NextResponse.json({ success: true, tables: counts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
