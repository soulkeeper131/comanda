import { db } from "@/db";
import { properties, users, organizations } from "@/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Check for force-reseed
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

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

    // Force reseed: delete all existing data
    if (force) {
      db.run(sql`DELETE FROM properties`);
      db.run(sql`DELETE FROM users`);
      db.run(sql`DELETE FROM organizations`);
    }

    const existing = db.select().from(properties).all();
    if (existing.length > 0) {
      return NextResponse.json({ message: "Вече има данни", count: existing.length });
    }

    // Insert org
    db.run(sql`INSERT OR IGNORE INTO organizations (id, name, slug) VALUES ('org1', 'КОМАНДА', 'komanda')`);

    // Hash passwords with bcrypt
    const usersToCreate = [
      { id: "u1", email: "admin@komanda.bg",    password: "admin1234",    role: "admin",     name: "Админ" },
      { id: "u2", email: "owner@komanda.bg",    password: "owner1234",    role: "owner",     name: "Собственик" },
      { id: "u3", email: "worker@komanda.bg",   password: "worker1234",   role: "worker",    name: "Работник" },
      { id: "u4", email: "inspector@komanda.bg", password: "inspector1234", role: "inspector", name: "Инспектор" },
    ];

    for (const u of usersToCreate) {
      const hash = await bcrypt.hash(u.password, 10);
      db.insert(users).values({
        id: u.id,
        org_id: "org1",
        email: u.email,
        password_hash: hash,
        role: u.role,
        full_name: u.name,
        active: true,
      }).run();
    }

    const props: [string, number, number, string][] = [
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
