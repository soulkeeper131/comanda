import { validateUser, setSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const user = validateUser(email, password);
  if (!user) {
    return NextResponse.json({ error: "Грешен имейл или парола" }, { status: 401 });
  }

  await setSession(user);
  return NextResponse.json({ success: true, user: { name: user.name, role: user.role } });
}
