import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendVerification } from "@/lib/auth-tokens";
import { isValidEmail } from "@/lib/domain/email";
import { allowOnce } from "@/lib/throttle";

export const dynamic = "force-dynamic";

// @public Повторен линк за потвърждение — потребителят още не може да влезе.
// Отговорът е еднакъв за познат и непознат имейл (не издава кой е регистриран).
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}));
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = isValidEmail(normalized) ? db.select().from(users).where(eq(users.email, normalized)).get() : undefined;
  if (user && !user.email_verified_at && user.active !== false && allowOnce(`verify:${user.id}`, 10 * 60_000)) {
    await sendVerification(user.id);
  }
  return NextResponse.json({ success: true });
}
