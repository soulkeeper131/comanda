import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getNotifyEmail, sendTestEmail } from "@/lib/email";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/email/test — пробен имейл до адреса за известия на екипа (или до
 * админа, ако няма такъв). Чака истинския отговор на сървъра — грешна парола
 * или хост се показва веднага, а не като „изпратен".
 */
export const POST = withAuth({ role: ["admin"] }, async (_request, { session }) => {
  const me = db.select({ email: users.email }).from(users).where(eq(users.id, session.uid)).get();
  const to = (await getNotifyEmail()) || me?.email;
  if (!to) return NextResponse.json({ error: "Няма адрес, до който да пратим пробата" }, { status: 400 });
  const res = await sendTestEmail(to);
  if (!res.ok) return NextResponse.json({ error: `Имейлът не тръгна: ${res.error}` }, { status: 502 });
  return NextResponse.json({ success: true, to });
});
