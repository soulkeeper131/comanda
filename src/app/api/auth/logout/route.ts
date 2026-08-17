import { clearSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// @public Изход от системата — трябва да работи дори със счупена/изтекла сесия.
export async function POST() {
  await clearSession();
  return NextResponse.json({ success: true });
}
