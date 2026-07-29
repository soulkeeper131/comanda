import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const USERS: Record<string, { name: string; email: string; role: string }> = {
  u1: { name: "Админ", email: "admin@komanda.bg", role: "admin" },
  u2: { name: "Собственик", email: "owner@komanda.bg", role: "owner" },
  u3: { name: "Работник", email: "worker@komanda.bg", role: "worker" },
  u4: { name: "Инспектор", email: "inspector@komanda.bg", role: "inspector" },
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
  }

  const user = USERS[session.uid];
  if (!user) {
    return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
  }

  return NextResponse.json({
    id: session.uid,
    name: user.name,
    email: user.email,
    role: session.role,
  });
}
