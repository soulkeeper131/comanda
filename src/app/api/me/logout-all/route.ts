import { NextResponse } from "next/server";
import { revokeSessions, sessionFor, setSession, withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/logout-all — „Изход от всички други устройства": всички
 * издадени сесии спират да важат (изгубен телефон, споделен компютър);
 * текущото устройство получава нова и остава влязло.
 */
export const POST = withAuth({}, async (_request, { session }) => {
  revokeSessions(session.uid);
  await setSession(sessionFor({ id: session.uid, role: session.role, org_id: session.org_id }, session.org_id));
  return NextResponse.json({ success: true });
});
