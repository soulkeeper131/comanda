import { listUsers } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = listUsers();
    const result = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: true,
    }));
    return NextResponse.json({ users: result });
  } catch (err) {
    console.error("[USERS] Error:", err);
    return NextResponse.json({ error: "Грешка при зареждане на потребители" }, { status: 500 });
  }
}
