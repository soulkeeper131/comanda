import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendPasswordReset } from "@/lib/auth-tokens";

export const dynamic = "force-dynamic";

// @public Забравена парола — по дефиниция без сесия. Еднакъв отговор за
// познат и непознат имейл.
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}));
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = normalized ? db.select().from(users).where(eq(users.email, normalized)).get() : undefined;
  if (user && user.active !== false) await sendPasswordReset(user.id);
  return NextResponse.json({ success: true });
}
