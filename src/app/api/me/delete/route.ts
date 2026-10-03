import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clearSession, withAuth } from "@/lib/auth";
import { deleteAccount, deletionBlocker } from "@/lib/account";

export const dynamic = "force-dynamic";

/** GET /api/me/delete — може ли профилът да се изтрие сега и защо не. */
export const GET = withAuth({}, async (_request, { session }) => {
  return NextResponse.json({ blocker: deletionBlocker(session.uid) });
});

/**
 * POST /api/me/delete {password} — изтриване на профила (чл. 17 GDPR).
 * Паролата пази от изтриване от чужда отворена сесия.
 */
export const POST = withAuth({}, async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const user = db.select().from(users).where(eq(users.id, session.uid)).get();
  if (!user) return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
  const ok = typeof body.password === "string" && (await bcrypt.compare(body.password, user.password_hash));
  if (!ok) return NextResponse.json({ error: "Паролата не е вярна" }, { status: 400 });

  const res = await deleteAccount(session.uid);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  await clearSession();
  return NextResponse.json({ success: true });
});
