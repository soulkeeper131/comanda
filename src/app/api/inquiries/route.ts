import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { withAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { notify } from "@/lib/messages";

export const dynamic = "force-dynamic";

// @public Формата от публичния landing сайт — идва преди всякаква сесия.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, phone, email, city, property_kind, service, message } = body;

    // Скрито поле срещу ботове: човек не го вижда, бот го попълва.
    if (body.website) return NextResponse.json({ success: true }, { status: 201 });
    const tooLong = [full_name, phone, email, city, property_kind, service].some(
      (v) => typeof v === "string" && v.length > 200,
    );
    if (tooLong || (typeof message === "string" && message.length > 3000)) {
      return NextResponse.json({ error: "Твърде дълъг текст" }, { status: 400 });
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Невалиден имейл" }, { status: 400 });
    }

    if (!full_name || !full_name.trim()) {
      return NextResponse.json({ error: "Името е задължително" }, { status: 400 });
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: "Имейлът е задължителен" }, { status: 400 });
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
    if (record.email) await notify("inquiry_received", { emailTo: record.email, vars: { name: record.full_name } });

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
