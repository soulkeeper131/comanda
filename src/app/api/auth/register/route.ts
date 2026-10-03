import { createUser, setSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDefaultOrgId } from "@/lib/org";
import { NextResponse } from "next/server";
import { sendVerification, TERMS_VERSION } from "@/lib/auth-tokens";
import { notify } from "@/lib/messages";

export const dynamic = "force-dynamic";

// @public Регистрация на нов потребител — по дефиниция става преди да има сесия.
export async function POST(request: Request) {
  let email = "", password = "", name = "", phone = "";
  let is_company = false, company_name = "", eik = "", vat_number = "", billing_address = "";
  let accept_terms = false;
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
    billing_address = (body.billing_address || "").trim().slice(0, 200);
    accept_terms = body.accept_terms === true;
  } catch {
    return NextResponse.json({ error: "Невалидна заявка" }, { status: 400 });
  }

  // Validation
  if (!email) {
    return NextResponse.json({ error: "Имейлът е задължителен" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Паролата трябва да е поне 8 символа" }, { status: 400 });
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
    if (!billing_address) {
      return NextResponse.json({ error: "Адресът на регистрация е задължителен за фактурите" }, { status: 400 });
    }
  }

  if (!accept_terms) {
    return NextResponse.json(
      { error: "Необходимо е съгласие с Общите условия и Политиката за поверителност" },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Невалиден имейл адрес" }, { status: 400 });
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
      billing_address: is_company ? billing_address : undefined,
    });
    db.update(users)
      .set({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
      .where(eq(users.id, user.id))
      .run();

    await notify("account_new_team", { to: "admins", vars: { client: user.name, email: user.email } });

    // Потвърждение на имейла преди първия вход — грешен адрес значи клиент,
    // който не получава оферти, напомняния и фактури.
    const sent = await sendVerification(user.id);
    if (sent) {
      return NextResponse.json({ success: true, verify_required: true, email: user.email });
    }
    // Без SMTP (локално) — адресът е приет, влиза веднага.
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
