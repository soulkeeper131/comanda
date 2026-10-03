import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { withAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { notify } from "@/lib/messages";
import { isValidEmail } from "@/lib/domain/email";
import { allowOnce } from "@/lib/throttle";

export const dynamic = "force-dynamic";

// @public Формата от публичния landing сайт — идва преди всякаква сесия.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, phone, email, city, property_kind, service, message } = body;

    // Скрито поле срещу ботове: човек не го вижда, бот го попълва.
    if (body.website) return NextResponse.json({ success: true }, { status: 201 });
    const fields = [full_name, phone, email, city, property_kind, service, message];
    if (fields.some((v) => v !== undefined && v !== null && typeof v !== "string")) {
      return NextResponse.json({ error: "Невалидни данни" }, { status: 400 });
    }
    const tooLong = [phone, city, property_kind, service].some((v) => typeof v === "string" && v.length > 120);
    if (tooLong || (full_name?.length ?? 0) > 100 || (typeof message === "string" && message.length > 3000)) {
      return NextResponse.json({ error: "Твърде дълъг текст" }, { status: 400 });
    }
    if (!isValidEmail(typeof email === "string" ? email.trim() : email)) {
      return NextResponse.json({ error: "Невалиден имейл" }, { status: 400 });
    }

    if (!full_name || !full_name.trim()) {
      return NextResponse.json({ error: "Името е задължително" }, { status: 400 });
    }

    const [record] = db
      .insert(inquiries)
      .values({
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        email: email.trim(),
        city: city?.trim() || null,
        property_kind: property_kind?.trim() || null,
        service: service?.trim() || null,
        message: message?.trim() || null,
      })
      .returning()
      .all();

    // Полетата идват от публична форма — шаблонът ги екранира. Отговорът
    // („Reply") на имейла до екипа отива направо при човека.
    await notify("inquiry_new", {
      to: "admins",
      vars: { name: record.full_name, service: record.service ?? "", city: record.city ?? "" },
      rows: [
        ["Телефон", record.phone],
        ["Имейл", record.email],
        ["Вид имот", record.property_kind],
        ["Съобщение", record.message],
      ],
      replyTo: record.email ?? undefined,
    });
    // Потвърждението отива до въведения от непознат адрес — най-много веднъж
    // на ден до един адрес, за да не стане формата начин за спам.
    if (record.email && allowOnce(`inquiry:${record.email.toLowerCase()}`, 24 * 3600_000)) {
      await notify("inquiry_received", { emailTo: record.email, vars: { name: record.full_name } });
    }

    return NextResponse.json({ success: true, id: record.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inquiries error:", error);
    return NextResponse.json({ error: "Грешка при изпращане на запитване" }, { status: 500 });
  }
}

/** GET /api/inquiries — запитванията от сайта (само админ). */
export const GET = withAuth({ role: ["admin"] }, async () => {
  const rows = db.select().from(inquiries).orderBy(desc(inquiries.created_at)).limit(300).all();
  return NextResponse.json(rows);
});
