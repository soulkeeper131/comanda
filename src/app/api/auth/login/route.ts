import { validateUser, setSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  console.log(`[LOGIN] Attempt: ${email}`);

  // DB-backed check
  const user = await validateUser(email, password);
  if (!user) {
    console.log(`[LOGIN] FAIL: ${email} — грешен имейл, парола или деактивиран акаунт`);
    return NextResponse.json({ error: "Грешен имейл или парола" }, { status: 401 });
  }

  console.log(`[LOGIN] OK: ${email} (${user.role})`);
  await setSession(user);

  return NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
