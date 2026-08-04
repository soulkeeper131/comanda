import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Disable FK then delete only tables that exist
    db.run(sql`PRAGMA foreign_keys = OFF`);
    db.run(sql`DELETE FROM properties`);
    db.run(sql`DELETE FROM users`);
    db.run(sql`DELETE FROM organizations`);
    db.run(sql`PRAGMA foreign_keys = ON`);

    // Re-insert org
    db.run(sql`INSERT OR REPLACE INTO organizations (id, name, slug) VALUES ('org1', 'КОМАНДА', 'komanda')`);

    const list = [
      { id: "u1", email: "admin@komanda.bg",    password: "admin1234",    role: "admin",     name: "Админ" },
      { id: "u2", email: "client@komanda.bg",   password: "client1234",   role: "client",    name: "Клиент" },
      { id: "u4", email: "inspector@komanda.bg", password: "inspector1234", role: "inspector", name: "Инспектор" },
    ];

    for (const u of list) {
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

    // Re-insert 5 properties
    const dbDirect = db as any;
    const props = [
      ["ул. Цар Иван Асен II 12", 42.6934, 23.3247, "apartment"],
      ["бул. България 81", 42.6791, 23.3025, "apartment"],
      ["ул. Оборище 45", 42.6972, 23.3412, "house"],
      ["жк. Лозенец, ул. Златовръх 3", 42.6762, 23.3198, "apartment"],
      ["кв. Драгалевци, ул. Панорамен път 7", 42.6321, 23.3057, "house"],
    ];

    for (const [addr, lat, lng, kind] of props) {
      const name = addr.split(",")[0].trim().replace(/^(ул\.|бул\.|жк\.|кв\.)\s*/, "");
      const fullAddr = `София, ${addr}`;
      dbDirect.run(
        `INSERT INTO properties (id, org_id, owner_id, name, address, lat, lng, kind) VALUES (?, 'org1', 'u2', ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), name, fullAddr, lat, lng, kind]
      );
    }

    return NextResponse.json({ success: true, users: list.length, properties: props.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
