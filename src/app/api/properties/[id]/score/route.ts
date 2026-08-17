import { NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";

export const dynamic = "force-dynamic";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateScore(id: string) {
  const h = hashString(id);

  // Generate "seed" values 0–1 from different parts of the hash
  const s1 = ((h * 7) % 100) / 100;
  const s2 = ((h * 13) % 100) / 100;
  const s3 = ((h * 17) % 100) / 100;
  const s4 = ((h * 23) % 100) / 100;

  const details = [
    {
      label: "Редовност на обходи",
      value: Math.round(6 + s1 * 6), // 6–12
      max: 12,
    },
    {
      label: "Снимкови отчети",
      value: Math.round(5 + s2 * 7), // 5–12
      max: 12,
    },
    {
      label: "GPS потвърждение",
      value: Math.round(7 + s3 * 5), // 7–12
      max: 12,
    },
    {
      label: "Без констатации",
      value: Math.round(1 + s4 * 2), // 1–3
      max: 3,
    },
  ];

  // Each detail normalized to 0-1, then averaged
  const norm = details.map((d) => d.value / d.max);
  const avgRatio = norm.reduce((a, b) => a + b, 0) / norm.length;
  const maxScore = 100;
  const score = Math.round(avgRatio * maxScore);

  return { score, maxScore, details };
}

export const GET = withAuth({}, async (_request, { session, params }) => {
  const { id } = params;

  const property = db.select().from(properties).where(eq(properties.id, id)).get();
  if (!property) {
    return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
  }
  if (!canViewProperty(session, property)) {
    return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
  }

  const data = generateScore(id);
  return NextResponse.json(data);
});
