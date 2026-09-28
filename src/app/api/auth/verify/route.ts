import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setSession } from "@/lib/auth";
import { consumeToken } from "@/lib/auth-tokens";
import { getDefaultOrgId } from "@/lib/org";

export const dynamic = "force-dynamic";

// @public Линкът от имейла се отваря преди потребителят да има сесия.
export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({}));
  const userId = consumeToken(token, "verify_email");
  if (!userId) {
    return NextResponse.json({ error: "Линкът е невалиден или е изтекъл. Поискайте нов." }, { status: 400 });
  }
  const [user] = db
    .update(users)
    .set({ email_verified_at: new Date().toISOString() })
    .where(eq(users.id, userId))
    .returning()
    .all();
  if (!user || user.active === false) return NextResponse.json({ error: "Профилът не е активен" }, { status: 403 });
  await setSession({ uid: user.id, role: user.role as "client", org_id: user.org_id ?? getDefaultOrgId() });
  // Нов клиент без имот продължава с добавяне на имот; останалите — в приложението.
  const hasProperty = db.select({ id: properties.id }).from(properties).where(eq(properties.owner_id, user.id)).get();
  const next = user.role === "client" && !hasProperty ? "/register/property" : "/dashboard";
  return NextResponse.json({ success: true, role: user.role, next });
}
