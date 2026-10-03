import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendPasswordReset } from "@/lib/auth-tokens";
import { isValidEmail } from "@/lib/domain/email";
import { allowOnce } from "@/lib/throttle";

export const dynamic = "force-dynamic";

// @public Забравена парола — по дефиниция без сесия. Еднакъв отговор за
// познат и непознат имейл.
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}));
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = isValidEmail(normalized) ? db.select().from(users).where(eq(users.email, normalized)).get() : undefined;
  // Най-много едно писмо на 10 минути до човек — иначе формата става начин
  // да се затрупа нечия поща.
  if (user && user.active !== false && allowOnce(`reset:${user.id}`, 10 * 60_000)) await sendPasswordReset(user.id);
  return NextResponse.json({ success: true });
}
