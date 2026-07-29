import { db } from "@/db";
import { properties } from "@/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Create tables if they don't exist
    db.run(sql`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE,
        accent TEXT DEFAULT '#1b98e0',
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id),
        email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'worker', full_name TEXT, phone TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(sql`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
        owner_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL, address TEXT, lat REAL NOT NULL, lng REAL NOT NULL,
        geofence_m INTEGER DEFAULT 75, kind TEXT DEFAULT 'apartment',
        access_notes TEXT, archived INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Seed default org + users + properties
    const existing = db.select().from(properties).all();
    if (existing.length > 0) {
      return NextResponse.json({ message: "Вече има данни", count: existing.length });
    }

    db.run(sql`INSERT OR IGNORE INTO organizations (id, name, slug) VALUES ('org1', 'КОМАНДА', 'komanda')`);
    db.run(sql`INSERT OR IGNORE INTO users (id, org_id, email, password_hash, role, full_name) VALUES
      ('u1', 'org1', 'admin@komanda.bg', 'admin1234', 'admin', 'Админ'),
      ('u2', 'org1', 'owner@komanda.bg', 'owner1234', 'owner', 'Собственик'),
      ('u3', 'org1', 'worker@komanda.bg', 'worker1234', 'worker', 'Работник'),
      ('u4', 'org1', 'inspector@komanda.bg', 'inspector1234', 'inspector', 'Инспектор')
    `);

    const props = [
      ["ул. Цар Иван Асен II 12", 42.6934, 23.3247, "apartment"],
      ["бул. България 81", 42.6791, 23.3025, "apartment"],
      ["ул. Оборище 45", 42.6972, 23.3412, "house"],
      ["жк. Лозенец, ул. Златовръх 3", 42.6762, 23.3198, "apartment"],
      ["кв. Драгалевци, ул. Панорамен път 7", 42.6321, 23.3057, "house"],
    ];

    for (const [addr, lat, lng, kind] of props) {
      db.insert(properties).values({
        name: addr.split(",")[0].trim().replace(/^(ул\.|бул\.|жк\.|кв\.)\s*/, ""),
        address: `София, ${addr}`,
        lat,
        lng,
        kind,
        org_id: "org1",
        owner_id: "u2",
      }).run();
    }

    return NextResponse.json({ message: "Seed готов", count: db.select().from(properties).all().length });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Грешка при seed" }, { status: 500 });
  }
}
