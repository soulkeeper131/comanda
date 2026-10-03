import { withAuth, getUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { notify } from "@/lib/messages";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (_request, { session }) => {
  const user = getUser(session.uid);
  if (!user) {
    return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    company_name: user.company_name,
    eik: user.eik,
    vat_number: user.vat_number,
    billing_address: user.billing_address,
    // Тестовата среда (dev.comanda.bg) се показва с етикет в приложението.
    environment: process.env.APP_ENV || "production",
  });
});

const text = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) || null : undefined);

/**
 * PATCH /api/me — собствените данни (име, телефон, фирма за фактура) и смяна
 * на парола. Ролята и имейлът не се менят оттук.
 */
export const PATCH = withAuth({}, async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const user = db.select().from(users).where(eq(users.id, session.uid)).get();
  if (!user) return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });

  const updates: Partial<typeof users.$inferInsert> = {};
  for (const key of ["full_name", "phone", "company_name", "eik", "vat_number", "billing_address"] as const) {
    const v = text(body[key], key === "billing_address" ? 200 : 120);
    if (v !== undefined) updates[key] = v;
  }
  if (updates.full_name === null) {
    return NextResponse.json({ error: "Името не може да е празно" }, { status: 400 });
  }

  if (body.new_password !== undefined) {
    if (typeof body.new_password !== "string" || body.new_password.length < 8) {
      return NextResponse.json({ error: "Новата парола е поне 8 знака" }, { status: 400 });
    }
    const ok = typeof body.current_password === "string" && (await bcrypt.compare(body.current_password, user.password_hash));
    if (!ok) return NextResponse.json({ error: "Текущата парола не е вярна" }, { status: 400 });
    updates.password_hash = await bcrypt.hash(body.new_password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Няма промени" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();
  db.update(users).set(updates).where(eq(users.id, session.uid)).run();
  if (updates.password_hash) {
    await notify("account_password_changed", { emailTo: user.email, vars: { email: user.email } });
  }
  return NextResponse.json({ success: true });
});
