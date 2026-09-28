import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { exportAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

/** GET /api/me/export — всичките ми данни като JSON файл (чл. 15 и 20 GDPR). */
export const GET = withAuth({}, async (_request, { session }) => {
  const data = exportAccount(session.uid);
  if (!data) return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="komanda-danni-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
