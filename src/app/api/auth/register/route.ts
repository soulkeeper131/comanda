import { createUser, sessionFor, setSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDefaultOrgId } from "@/lib/org";
import { NextResponse } from "next/server";
import { sendVerification, TERMS_VERSION } from "@/lib/auth-tokens";
import { notify } from "@/lib/messages";
import { isEmailConfigured } from "@/lib/email";
import { isValidEmail } from "@/lib/domain/email";
import { allowOnce } from "@/lib/throttle";

export const dynamic = "force-dynamic";

// @public Регистрация на нов потребител — по дефиниция става преди да има сесия.
export async function POST(request: Request) {
  let email = "", password = "", name = "", phone = "";
  let is_company = false, company_name = "", eik = "", vat_number = "", billing_address = "";
  let accept_terms = false;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  try {
    const body = await request.json();
    email = str(body.email).toLowerCase();
    password = typeof body.password === "string" ? body.password : "";
    name = str(body.name);
    phone = str(body.phone);
    is_company = !!body.is_company;
    company_name = str(body.company_name);
    eik = str(body.eik);
    vat_number = str(body.vat_number);
    billing_address = str(body.billing_address).slice(0, 200);
    accept_terms = body.accept_terms === true;
  } catch {
    return NextResponse.json({ error: "Невалидна заявка" }, { status: 400 });
  }

  // Дължината — преди всичко друго (и преди регекса за имейла).
  if (!email) {
    return NextResponse.json({ error: "Имейлът е задължителен" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Невалиден имейл адрес" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Паролата трябва да е от 8 до 200 символа" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Името е задължително" }, { status: 400 });
  }
  if (name.length > 100 || phone.length > 30 || company_name.length > 150 || eik.length > 20 || vat_number.length > 20) {
    return NextResponse.json({ error: "Твърде дълъг текст в някое поле" }, { status: 400 });
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
  const mailReady = await isEmailConfigured();
  // В продукция без имейл сървър не регистрираме: адресът не може да бъде
  // потвърден, а приет без потвърждение значи профил с чужд имейл.
  if (!mailReady && process.env.NODE_ENV === "production" && process.env.APP_ENV !== "dev") {
    console.error("[REGISTER] SMTP не е настроен — регистрациите са спрени");
    return NextResponse.json(
      { error: "Регистрацията временно не работи. Пишете ни и ще ви създадем профил." },
      { status: 503 },
    );
  }

  // Имейл с профил: същият отговор като при нова регистрация (иначе формата
  // казва кои адреси имат профил), а на собственика — писмо с вход/нова парола.
  const exists = db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).get();
  if (exists) {
    if (!mailReady) {
      return NextResponse.json({ error: "Вече има регистриран потребител с този имейл" }, { status: 409 });
    }
    if (allowOnce(`exists:${exists.id}`, 6 * 3600_000)) {
      await notify("account_exists", { emailTo: exists.email, link: "/forgot-password" });
    }
    return NextResponse.json({ success: true, verify_required: true, email });
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
    // Без SMTP (локално и на тестовата среда) — адресът е приет, влиза веднага.
    await setSession(sessionFor(user, orgId));
    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[REGISTER] Error:", err);
    return NextResponse.json({ error: "Грешка при регистрация" }, { status: 500 });
  }
}
