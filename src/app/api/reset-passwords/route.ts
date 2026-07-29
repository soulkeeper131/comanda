import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Disable FK checks temporarily
    db.run(sql`PRAGMA foreign_keys = OFF`);

    // Delete all existing data in correct order
    db.run(sql`DELETE FROM push_subscriptions`);
    db.run(sql`DELETE FROM offers`);
    db.run(sql`DELETE FROM finding_photos`);
    db.run(sql`DELETE FROM findings`);
    db.run(sql`DELETE FROM evidence`);
    db.run(sql`DELETE FROM job_items`);
    db.run(sql`DELETE FROM jobs`);
    db.run(sql`DELETE FROM plans`);
    db.run(sql`DELETE FROM template_items`);
    db.run(sql`DELETE FROM service_templates`);
    db.run(sql`DELETE FROM zones`);
    db.run(sql`DELETE FROM properties`);
    db.run(sql`DELETE FROM users`);
    db.run(sql`DELETE FROM organizations`);

    // Re-enable FK checks
    db.run(sql`PRAGMA foreign_keys = ON`);

    const list = [
      { id: "u1", email: "admin@komanda.bg",    password: "admin1234",    role: "admin",     name: "Админ" },
      { id: "u2", email: "owner@komanda.bg",    password: "owner1234",    role: "owner",     name: "Собственик" },
      { id: "u3", email: "worker@komanda.bg",   password: "worker1234",   role: "worker",    name: "Работник" },
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

    return NextResponse.json({ success: true, count: list.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
