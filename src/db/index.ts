import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(path.join(dbDir, "sqlite.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Миграция и seed се изпълняват САМО в runtime (node server.js), НЕ при
// `next build` (page data collection). При build паралелни worker-и биха
// писали едновременно в SQLite → `database is locked` (SQLITE_BUSY).
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!isBuildPhase) {
  // Auto-migrate при старт: прилага drizzle/ миграциите, ако още не са приложени.
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    try {
      migrate(db, { migrationsFolder });
      console.log("[db] Миграциите са приложени (или вече бяха).");
    } catch (e) {
      console.error("[db] Миграцията се провали:", e);
    }
  }

  // Seed при старт: ако няма нито един потребител, създава тестовите акаунти.
  try {
    const count = sqlite.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
    if (count.c === 0) {
      const orgId = "org1";
      sqlite.prepare(
        "INSERT OR IGNORE INTO organizations (id, name, slug) VALUES (?, ?, ?)"
      ).run(orgId, "КОМАНДА", "komanda");

      const seedUsers = [
        { id: "u1", email: "admin@komanda.bg", role: "admin", name: "Админ", env: "SEED_ADMIN_PASSWORD", fallback: "admin1234" },
        { id: "u2", email: "client@komanda.bg", role: "client", name: "Клиент", env: "SEED_CLIENT_PASSWORD", fallback: "client1234" },
        { id: "u4", email: "inspector@komanda.bg", role: "inspector", name: "Инспектор", env: "SEED_INSPECTOR_PASSWORD", fallback: "inspector1234" },
      ];

      for (const u of seedUsers) {
        const password = process.env[u.env] || u.fallback;
        const hash = bcrypt.hashSync(password, 10);
        sqlite.prepare(
          "INSERT OR IGNORE INTO users (id, org_id, email, password_hash, role, full_name, active) VALUES (?, ?, ?, ?, ?, ?, 1)"
        ).run(u.id, orgId, u.email, hash, u.role, u.name);
      }

      console.log("[db] Seed при старт: създадени тестови потребители (admin@komanda.bg, client@komanda.bg, inspector@komanda.bg).");
    }
  } catch (e) {
    console.error("[db] Seed при старт се провали:", e);
  }
}
