import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = raw ? verifySession(raw) : null;
  if (!session) redirect("/login");
  return <>{children}</>;
}
