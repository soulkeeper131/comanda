import { createUser, setSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDefaultOrgId } from "@/lib/org";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// @public Регистрация на нов потребител — по дефиниция става преди да има сесия.
export async function POST(request: Request) {
  let email = "", password = "", name = "", phone = "";
  let is_company = false, company_name = "", eik = "", vat_number = "";
  try {
    const body = await request.json();
    email = (body.email || "").trim().toLowerCase();
    password = body.password || "";
    name = (body.name || "").trim();
    phone = (body.phone || "").trim();
    is_company = !!body.is_company;
    company_name = (body.company_name || "").trim();
    eik = (body.eik || "").trim();
    vat_number = (body.vat_number || "").trim();
  } catch {
    return NextResponse.json({ error: "Невалидна заявка" }, { status: 400 });
  }

  // Validation
  if (!email) {
    return NextResponse.json({ error: "Имейлът е задължителен" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Паролата трябва да е поне 6 символа" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Името е задължително" }, { status: 400 });
  }
  if (is_company) {
    if (!company_name) {
      return NextResponse.json({ error: "Името на фирмата е задължително" }, { status: 400 });
    }
    if (!eik) {
      return NextResponse.json({ error: "ЕИК е задължително" }, { status: 400 });
    }
  }

  // Check uniqueness
  const exists = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (exists) {
    return NextResponse.json({ error: "Вече има регистриран потребител с този имейл" }, { status: 409 });
  }

  try {
    const orgId = getDefaultOrgId();
    const user = await createUser(email, password, name, "client", orgId, {
      phone: phone || undefined,
      company_name: is_company ? company_name : undefined,
      eik: is_company ? eik : undefined,
      vat_number: is_company ? (vat_number || undefined) : undefined,
    });
    await setSession({ uid: user.id, role: user.role, org_id: user.org_id ?? orgId });
    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[REGISTER] Error:", err);
    return NextResponse.json({ error: "Грешка при регистрация" }, { status: 500 });
  }
}
