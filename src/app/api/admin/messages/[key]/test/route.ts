import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { MESSAGES, renderMessage, type MessageKey } from "@/lib/messages";

export const dynamic = "force-dynamic";

/** POST — пробен имейл с примерните данни до имейла на админа, който го пуска. */
export const POST = withAuth({ role: ["admin"] }, async (_request, { session, params }) => {
  const key = params.key as MessageKey;
  if (!Object.prototype.hasOwnProperty.call(MESSAGES, key)) {
    return NextResponse.json({ error: "Няма такова съобщение" }, { status: 404 });
  }
  if (!(await isEmailConfigured())) return NextResponse.json({ error: "SMTP не е настроен" }, { status: 409 });
  const me = db.select({ email: users.email }).from(users).where(eq(users.id, session.uid)).get();
  if (!me?.email) return NextResponse.json({ error: "Профилът ви няма имейл" }, { status: 400 });
  const def = MESSAGES[key];
  const msg = renderMessage(key, def.sample, { rows: def.sampleRows });
  await sendEmail({ to: me.email, subject: `[Проба] ${msg.subject}`, html: msg.html });
  return NextResponse.json({ success: true, to: me.email });
});
