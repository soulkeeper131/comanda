import { withAuth, getUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (_request, { session }) => {
  const user = getUser(session.uid);
  if (!user) {
    return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    company_name: user.company_name,
    eik: user.eik,
    vat_number: user.vat_number,
  });
});
