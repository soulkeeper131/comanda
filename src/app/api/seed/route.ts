import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const MOCK_USERS = [
  { email: "admin@komanda.bg", password: "admin123", name: "Владимир Тодоров" },
  { email: "owner@komanda.bg", password: "owner123", name: "Иван Петров" },
  { email: "worker@komanda.bg", password: "worker123", name: "Георги Димитров" },
  { email: "inspector@komanda.bg", password: "inspector123", name: "Мария Стоянова" },
];

export async function GET() {
  const results: string[] = [];

  for (const user of MOCK_USERS) {
    try {
      await auth.api.signUpEmail({
        body: {
          email: user.email,
          password: user.password,
          name: user.name,
        },
      });
      results.push(`✅ ${user.email}`);
    } catch (e: any) {
      if (e?.status === 422 || e?.message?.includes("already")) {
        results.push(`⏭️ ${user.email} (вече съществува)`);
      } else {
        results.push(`❌ ${user.email}: ${e?.message || e}`);
      }
    }
  }

  return NextResponse.json({ results });
}
