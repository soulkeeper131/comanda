import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revokeSessions, sessionFor, setSession } from "@/lib/auth";
import { consumeToken } from "@/lib/auth-tokens";
import { notify } from "@/lib/messages";
import { getDefaultOrgId } from "@/lib/org";

export const dynamic = "force-dynamic";

// @public Нова парола по линк от имейла — потребителят няма сесия.
export async function POST(request: Request) {
  const { token, password } = await request.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Паролата трябва да е от 8 до 200 символа" }, { status: 400 });
  }
  const userId = consumeToken(token, "reset_password");
  if (!userId) {
    return NextResponse.json({ error: "Линкът е невалиден или е изтекъл. Поискайте нов." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const [user] = db
    .update(users)
    // Линкът е стигнал до пощата — значи адресът е потвърден. Заключването
    // след грешни опити пада — новата парола е нов старт.
    .set({ password_hash: await bcrypt.hash(password, 10), email_verified_at: now, updated_at: now, failed_logins: 0, locked_until: null })
    .where(eq(users.id, userId))
    .returning()
    .all();
  if (!user || user.active === false) return NextResponse.json({ error: "Профилът не е активен" }, { status: 403 });
  // Нова парола — всички стари сесии (и откраднати бисквитки) спират.
  revokeSessions(user.id);
  await setSession(sessionFor(user, getDefaultOrgId()));
  await notify("account_password_changed", { emailTo: user.email, vars: { email: user.email } });
  return NextResponse.json({ success: true });
}
