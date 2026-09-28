import { NextResponse } from "next/server";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "contacted", "converted", "closed"];

/** PATCH /api/inquiries/[id] { status } — обработено запитване. */
export const PATCH = withAuth({ role: ["admin"] }, async (request, { params }) => {
  const { status } = await request.json().catch(() => ({}));
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "Невалиден статус" }, { status: 400 });
  const [row] = db.update(inquiries).set({ status }).where(eq(inquiries.id, params.id)).returning().all();
  if (!row) return NextResponse.json({ error: "Не е намерено" }, { status: 404 });
  return NextResponse.json(row);
});
