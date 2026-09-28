import { validateUser, setSession } from "@/lib/auth";
import { getDefaultOrgId } from "@/lib/org";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// @public Вход в системата — по дефиниция става преди да има сесия.
export async function POST(request: Request) {
  let email = "", password = "";
  try {
    const body = await request.json();
    email = (body.email || "").trim().toLowerCase();
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "Невалидна заявка" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Имейл и парола са задължителни" }, { status: 400 });
  }

  // DB-backed check
  const user = await validateUser(email, password);
  if (!user) {
    console.log("[LOGIN] Неуспешен опит за вход");
    return NextResponse.json({ error: "Грешен имейл или парола" }, { status: 401 });
  }

  const row = db.select({ verified: users.email_verified_at }).from(users).where(eq(users.id, user.id)).get();
  if (!row?.verified) {
    return NextResponse.json(
      { error: "Потвърдете имейла си — изпратихме ви линк при регистрацията.", verify_required: true },
      { status: 403 },
    );
  }

  await setSession({ uid: user.id, role: user.role, org_id: user.org_id ?? getDefaultOrgId() });

  return NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
