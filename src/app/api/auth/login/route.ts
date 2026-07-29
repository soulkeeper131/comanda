import { validateUser, setSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let email = "", password = "";
  try {
    const body = await request.json();
    email = body.email || "";
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "Невалидна заявка" }, { status: 400 });
  }

  console.log(`[LOGIN] Attempt: ${email}`);

  // Check credentials
  const user = validateUser(email, password);
  if (!user) {
    console.log(`[LOGIN] FAIL: ${email} — wrong password or unknown user`);
    return NextResponse.json({ error: "Грешен имейл или парола" }, { status: 401 });
  }

  console.log(`[LOGIN] OK: ${email} (${user.role})`);
  await setSession(user);

  return NextResponse.json({ success: true, user: { name: user.name, role: user.role } });
}
