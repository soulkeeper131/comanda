import { db } from "@/db";
import {
  properties,
  users,
  organizations,
  serviceTemplates,
  templateItems,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Check for force-reseed via body
    let force = false;
    try {
      const body = await request.json();
      force = body.force === true;
    } catch {}
    // Also check query param
    if (!force) {
      const url = new URL(request.url);
      force = url.searchParams.get("force") === "true";
    }

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

    db.run(sql`
      CREATE TABLE IF NOT EXISTS service_templates (
        id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
        category TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
        icon TEXT DEFAULT '🧹', duration_min INTEGER DEFAULT 60,
        price REAL DEFAULT 0, bookable INTEGER DEFAULT 1,
        archived INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(sql`
      CREATE TABLE IF NOT EXISTS template_items (
        id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES service_templates(id),
        zone_label TEXT, label TEXT NOT NULL, proof_type TEXT DEFAULT 'photo',
        required INTEGER DEFAULT 1, sort INTEGER DEFAULT 0
      )
    `);

    // Force reseed: delete all existing data
    if (force) {
      db.run(sql`DELETE FROM properties`);
      db.run(sql`DELETE FROM users`);
      db.run(sql`DELETE FROM organizations`);
      db.run(sql`DELETE FROM service_templates`);
      db.run(sql`DELETE FROM template_items`);
    }

    let results: string[] = [];
    const existingProps = db.select().from(properties).all();
    if (existingProps.length === 0) {
      // Insert org
      db.run(
        sql`INSERT OR IGNORE INTO organizations (id, name, slug) VALUES ('org1', 'КОМАНДА', 'komanda')`
      );

      // Hash passwords with bcrypt
      const usersToCreate = [
        { id: "u1", email: "admin@komanda.bg", password: "admin1234", role: "admin", name: "Админ" },
        { id: "u2", email: "owner@komanda.bg", password: "owner1234", role: "owner", name: "Собственик" },
        { id: "u3", email: "worker@komanda.bg", password: "worker1234", role: "worker", name: "Работник" },
        { id: "u4", email: "inspector@komanda.bg", password: "inspector1234", role: "inspector", name: "Инспектор" },
      ];

      for (const u of usersToCreate) {
        const hash = await bcrypt.hash(u.password, 10);
        db.insert(users)
          .values({
            id: u.id,
            org_id: "org1",
            email: u.email,
            password_hash: hash,
            role: u.role,
            full_name: u.name,
            active: true,
          })
          .run();
      }

      const props: [string, number, number, string][] = [
        ["ул. Цар Иван Асен II 12", 42.6934, 23.3247, "apartment"],
        ["бул. България 81", 42.6791, 23.3025, "apartment"],
        ["ул. Оборище 45", 42.6972, 23.3412, "house"],
        ["жк. Лозенец, ул. Златовръх 3", 42.6762, 23.3198, "apartment"],
        ["кв. Драгалевци, ул. Панорамен път 7", 42.6321, 23.3057, "house"],
      ];

      for (const [addr, lat, lng, kind] of props) {
        db.insert(properties)
          .values({
            name: addr.split(",")[0].trim().replace(/^(ул\.|бул\.|жк\.|кв\.)\s*/, ""),
            address: `София, ${addr}`,
            lat,
            lng,
            kind,
            org_id: "org1",
            owner_id: "u2",
          })
          .run();
      }
      results.push("Организации, потребители и имоти — създадени");
    } else {
      results.push(`Вече има ${existingProps.length} имота — пропуснато`);
    }

    // Seed service_templates if empty
    const existingTemplates = db.select().from(serviceTemplates).all();
    if (existingTemplates.length === 0) {
      const templates = [
        {
          id: "tpl1",
          category: "cleaning",
          name: "Основно почистване",
          description: "Прах, прахосмукачка, мокър под, баня, кухня",
          icon: "🧹",
          duration_min: 120,
          price: 80,
        },
        {
          id: "tpl2",
          category: "inspection",
          name: "Технически обход",
          description: "Проверка на ВиК, ел. инсталация, дограма, общо състояние",
          icon: "🔍",
          duration_min: 60,
          price: 50,
        },
        {
          id: "tpl3",
          category: "repair",
          name: "Дребни ремонти",
          description: "Смяна на крушки, уплътнения, дръжки, силикон",
          icon: "🔧",
          duration_min: 90,
          price: 100,
        },
      ];

      for (const t of templates) {
        db.insert(serviceTemplates)
          .values({
            id: t.id,
            org_id: "org1",
            category: t.category,
            name: t.name,
            description: t.description,
            icon: t.icon,
            duration_min: t.duration_min,
            price: t.price,
            bookable: true,
            archived: false,
          })
          .run();
      }
      results.push(`${templates.length} сервизни шаблона — създадени`);
    } else {
      results.push(`Вече има ${existingTemplates.length} шаблона — пропуснато`);
    }

    // Seed template_items if empty
    const existingItems = db.select().from(templateItems).all();
    if (existingItems.length === 0) {
      const items = [
        // tpl1 — Основно почистване
        { id: "ti1", template_id: "tpl1", zone_label: "Всекидневна", label: "Прах по повърхности", proof_type: "photo", required: true, sort: 1 },
        { id: "ti2", template_id: "tpl1", zone_label: "Всекидневна", label: "Прахосмукачка", proof_type: "photo", required: true, sort: 2 },
        { id: "ti3", template_id: "tpl1", zone_label: "Всекидневна", label: "Мокър под", proof_type: "photo", required: true, sort: 3 },
        { id: "ti4", template_id: "tpl1", zone_label: "Кухня", label: "Плот и мивка", proof_type: "photo", required: true, sort: 4 },
        { id: "ti5", template_id: "tpl1", zone_label: "Кухня", label: "Котлони и абсорбатор", proof_type: "photo", required: true, sort: 5 },
        { id: "ti6", template_id: "tpl1", zone_label: "Баня", label: "Тоалетна и мивка", proof_type: "photo", required: true, sort: 6 },
        { id: "ti7", template_id: "tpl1", zone_label: "Баня", label: "Душ / вана", proof_type: "photo", required: true, sort: 7 },
        // tpl2 — Технически обход
        { id: "ti8", template_id: "tpl2", zone_label: "Баня", label: "Проверка за течове", proof_type: "photo", required: true, sort: 1 },
        { id: "ti9", template_id: "tpl2", zone_label: "Кухня", label: "Проверка на сифон и смесител", proof_type: "photo", required: true, sort: 2 },
        { id: "ti10", template_id: "tpl2", zone_label: "Общо", label: "Проверка на контакти и ключове", proof_type: "photo", required: true, sort: 3 },
        { id: "ti11", template_id: "tpl2", zone_label: "Общо", label: "Проверка на дограма", proof_type: "photo", required: true, sort: 4 },
        // tpl3 — Дребни ремонти
        { id: "ti12", template_id: "tpl3", zone_label: "Общо", label: "Смяна на изгорели крушки", proof_type: "photo", required: false, sort: 1 },
        { id: "ti13", template_id: "tpl3", zone_label: "Баня", label: "Силикон около вана / душ", proof_type: "photo", required: false, sort: 2 },
        { id: "ti14", template_id: "tpl3", zone_label: "Общо", label: "Смяна на уплътнения по врати", proof_type: "photo", required: false, sort: 3 },
      ];

      for (const item of items) {
        db.insert(templateItems)
          .values({
            id: item.id,
            template_id: item.template_id,
            zone_label: item.zone_label,
            label: item.label,
            proof_type: item.proof_type,
            required: item.required,
            sort: item.sort,
          })
          .run();
      }
      results.push(`${items.length} стъпки в шаблони — създадени`);
    } else {
      results.push(`Вече има ${existingItems.length} стъпки — пропуснато`);
    }

    return NextResponse.json({
      message: "Seed готов",
      details: results,
      property_count: db.select().from(properties).all().length,
      template_count: db.select().from(serviceTemplates).all().length,
      template_item_count: db.select().from(templateItems).all().length,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Грешка при seed" }, { status: 500 });
  }
}
