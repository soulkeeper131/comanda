import { cookies } from "next/headers";
import { SESSION_COOKIE, currentUserState, verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = raw ? verifySession(raw) : null;
  const state = session ? currentUserState(session.uid) : null;
  // Същата проверка като withAuth — отменена сесия не стига до таблото.
  if (!session || !state?.active || (session.sv ?? 0) !== state.sessionVersion) redirect("/login");
  return <>{children}</>;
}
