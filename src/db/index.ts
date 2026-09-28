import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const dbDir = path.join(process.cwd(), "data");

// При `next build` (page data collection) НЕ трябва да отваряме реалния
// SQLite файл — паралелните worker-и се заключват един друг (`database is
// locked`). По време на build ползваме in-memory база; реалната база се
// отваря само в runtime (node server.js).
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!isBuildPhase && !fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(isBuildPhase ? ":memory:" : path.join(dbDir, "sqlite.db"));
if (!isBuildPhase) {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
}

export const db = drizzle(sqlite, { schema });

/**
 * Резервно копие през SQLite backup API — коректно при WAL режим и докато
 * приложението пише (за разлика от копиране на файла).
 */
export async function backupDatabase(dest: string): Promise<void> {
  await sqlite.backup(dest);
}

const IGNORABLE = /already exists|duplicate column/i;

function applyMigrationsLeniently(folder: string) {
  const files = fs.readdirSync(folder).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    const statements = fs
      .readFileSync(path.join(folder, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        sqlite.exec(stmt);
        applied++;
      } catch (err) {
        if (!IGNORABLE.test(String(err))) {
          console.error(`[db] ${file}: изразът се провали:`, err);
        }
      }
    }
  }
  console.log(`[db] Поправка на схемата: приложени ${applied} израза.`);

  // Записваме миграциите като приложени, за да мине следващият старт по
  // нормалния път. Drizzle сравнява само по created_at (`when` от журнала).
  try {
    const journal = JSON.parse(
      fs.readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"),
    ) as { entries: { tag: string; when: number }[] };
    sqlite.exec(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)",
    );
    const have = new Set(
      (sqlite.prepare("SELECT created_at FROM __drizzle_migrations").all() as { created_at: number }[]).map(
        (r) => Number(r.created_at),
      ),
    );
    const insert = sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)");
    for (const entry of journal.entries) {
      if (have.has(entry.when)) continue;
      const content = fs.readFileSync(path.join(folder, `${entry.tag}.sql`), "utf8");
      insert.run(crypto.createHash("sha256").update(content).digest("hex"), entry.when);
    }
  } catch (err) {
    console.error("[db] Журналът на миграциите не можа да се обнови:", err);
  }
}

if (!isBuildPhase) {
  // Auto-migrate при старт: прилага drizzle/ миграциите, ако още не са приложени.
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    try {
      migrate(db, { migrationsFolder });
      console.log("[db] Миграциите са приложени (или вече бяха).");
    } catch (e) {
      // База, създадена преди журнала на миграциите (таблиците вече
      // съществуват, но __drizzle_migrations е празна), проваля migrate() още
      // на 0000 и никога не стига до новите колони. Тогава прилагаме всеки
      // израз поотделно, прескачайки „вече съществува" — изразите са
      // CREATE/ALTER ADD/идемпотентни UPDATE-и, така че повторът е безопасен.
      console.error("[db] Миграцията се провали, минаваме в режим на поправка:", e);
      applyMigrationsLeniently(migrationsFolder);
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
        { id: "u1", email: "admin@komanda.bg", role: "admin", name: "Админ", env: "SEED_ADMIN_PASSWORD" },
        { id: "u2", email: "client@komanda.bg", role: "client", name: "Клиент", env: "SEED_CLIENT_PASSWORD" },
        { id: "u4", email: "inspector@komanda.bg", role: "inspector", name: "Инспектор", env: "SEED_INSPECTOR_PASSWORD" },
      ];

      // Без парола по подразбиране. По-рано тук стоеше fallback "admin1234" —
      // ако променливата липсва на сървъра, продукцията тръгва с публично
      // известна админска парола. Празната база е по-безопасна от слаба.
      const missing = seedUsers.filter((u) => !process.env[u.env]);
      if (missing.length > 0) {
        console.error(
          "[db] Seed при старт ПРОПУСНАТ: липсват " +
            missing.map((u) => u.env).join(", ") +
            ". Задайте ги и рестартирайте, или пуснете `npm run db:seed` локално."
        );
      } else {
        for (const u of seedUsers) {
          const hash = bcrypt.hashSync(process.env[u.env] as string, 10);
          sqlite.prepare(
            "INSERT OR IGNORE INTO users (id, org_id, email, password_hash, role, full_name, active) VALUES (?, ?, ?, ?, ?, ?, 1)"
          ).run(u.id, orgId, u.email, hash, u.role, u.name);
        }
        console.log("[db] Seed при старт: създадени тестови потребители.");
      }
    }
  } catch (e) {
    console.error("[db] Seed при старт се провали:", e);
  }
}
