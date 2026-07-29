import { createUser, setSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let email = "", password = "", name = "";
  try {
    const body = await request.json();
    email = (body.email || "").trim().toLowerCase();
    password = body.password || "";
    name = (body.name || "").trim();
  } catch {
    return NextResponse.json({ error: "Невалидна заявка" }, { status: 400 });
  }

  // Validation
  if (!email) {
    return NextResponse.json({ error: "Имейлът е задължителен" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Паролата трябва да е поне 6 символа" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Името е задължително" }, { status: 400 });
  }

  // Check uniqueness
  const exists = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (exists) {
    return NextResponse.json({ error: "Вече има регистриран потребител с този имейл" }, { status: 409 });
  }

  try {
    const user = await createUser(email, password, name, "worker");
    await setSession(user);
    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[REGISTER] Error:", err);
    return NextResponse.json({ error: "Грешка при регистрация" }, { status: 500 });
  }
}
