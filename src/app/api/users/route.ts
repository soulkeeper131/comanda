import { db } from "@/db";
import { users, properties, jobs } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { sendInvite } from "@/lib/auth-tokens";
import { withAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const ROLES = ["admin", "client", "inspector"] as const;
type Role = (typeof ROLES)[number];
const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

/**
 * Инспектор, който напуска: имотите му остават без инспектор, а бъдещите
 * му планирани обходи — невъзложени, за да ги види админът в опашката.
 */
function releaseInspector(userId: string) {
  db.update(properties).set({ assigned_inspector_id: null }).where(eq(properties.assigned_inspector_id, userId)).run();
  db.update(jobs)
    .set({ assignee_id: null })
    .where(and(eq(jobs.assignee_id, userId), eq(jobs.status, "planned")))
    .run();
}

function view(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.full_name ?? "",
    email: u.email,
    phone: u.phone,
    role: u.role,
    active: u.active ?? true,
    created_at: u.created_at,
  };
}

// GET /api/users?all=1 — по подразбиране само активните
export const GET = withAuth({ role: ["admin"] }, async (request) => {
  try {
    const all = new URL(request.url).searchParams.get("all") === "1";
    const rows = db
      .select()
      .from(users)
      .where(all ? undefined : eq(users.active, true))
      .orderBy(asc(users.role), asc(users.full_name))
      .all();
    return NextResponse.json({ users: rows.map(view) });
  } catch (err) {
    console.error("[USERS] Error:", err);
    return NextResponse.json({ error: "Грешка при зареждане на потребители" }, { status: 500 });
  }
});

/**
 * POST /api/users — админът създава акаунт (инспектор, админ, или клиент,
 * който не може сам да се регистрира). Ако не е дадена парола, се генерира
 * временна и се връща ЕДИН път в отговора.
 */
export const POST = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const role = body.role;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Невалиден имейл" }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: "Името е задължително" }, { status: 400 });
    if (!isRole(role)) return NextResponse.json({ error: "Невалидна роля" }, { status: 400 });
    if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) {
      return NextResponse.json({ error: "Вече има потребител с този имейл" }, { status: 409 });
    }

    const given = typeof body.password === "string" ? body.password : "";
    if (given && given.length < 8) {
      return NextResponse.json({ error: "Паролата е поне 8 знака" }, { status: 400 });
    }
    const password = given || crypto.randomBytes(9).toString("base64url");

    const [created] = db
      .insert(users)
      .values({
        org_id: session.org_id,
        email,
        full_name: name,
        phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
        role,
        password_hash: await bcrypt.hash(password, 10),
        active: true,
        // Админът създава акаунта лично — адресът е проверен от него.
        email_verified_at: new Date().toISOString(),
      })
      .returning()
      .all();

    // С имейл — покана с връзка за парола; без SMTP — временната парола се
    // показва веднъж на админа.
    const invited = !given && (await sendInvite(created.id));
    return NextResponse.json(
      { ...view(created), invited, temporary_password: given || invited ? undefined : password },
      { status: 201 },
    );
  } catch (err) {
    console.error("[USERS POST] Error:", err);
    return NextResponse.json({ error: "Грешка при създаване на потребител" }, { status: 500 });
  }
});

export const PATCH = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { id, role, full_name, active, phone } = body;

    if (!id) {
      return NextResponse.json({ error: "ID на потребител е задължително" }, { status: 400 });
    }
    const existing = db.select().from(users).where(eq(users.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
    }

    const updates: Partial<typeof users.$inferInsert> = { updated_at: new Date().toISOString() };
    if (role !== undefined) {
      if (!isRole(role)) return NextResponse.json({ error: "Невалидна роля" }, { status: 400 });
      // Иначе админ може да си вземе правата сам и да остане без админ.
      if (id === session.uid && role !== "admin") {
        return NextResponse.json({ error: "Не можете да смените собствената си роля" }, { status: 403 });
      }
      updates.role = role;
    }
    if (full_name !== undefined) updates.full_name = String(full_name).trim();
    if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;
    if (active !== undefined) {
      if (id === session.uid && active === false) {
        return NextResponse.json({ error: "Не можете да деактивирате собствения си профил" }, { status: 403 });
      }
      updates.active = Boolean(active);
    }
    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "Няма полета за обновяване" }, { status: 400 });
    }

    const [updated] = db.update(users).set(updates).where(eq(users.id, id)).returning().all();
    if (updates.active === false || (updates.role && updates.role !== "inspector" && existing.role === "inspector")) {
      releaseInspector(id);
    }
    return NextResponse.json(view(updated));
  } catch (err) {
    console.error("[USERS PATCH] Error:", err);
    return NextResponse.json({ error: "Грешка при обновяване на потребител" }, { status: 500 });
  }
});

export const DELETE = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "ID на потребител е задължително" }, { status: 400 });
    if (id === session.uid) {
      return NextResponse.json({ error: "Не можете да деактивирате собствения си профил" }, { status: 403 });
    }
    const existing = db.select().from(users).where(eq(users.id, id)).get();
    if (!existing) return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });

    db.update(users).set({ active: false, updated_at: new Date().toISOString() }).where(eq(users.id, id)).run();
    releaseInspector(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[USERS DELETE] Error:", err);
    return NextResponse.json({ error: "Грешка при деактивиране на потребител" }, { status: 500 });
  }
});
