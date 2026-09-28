import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { emailLayout } from "@/lib/mail-layout";

export const dynamic = "force-dynamic";

// @public Формата от публичния landing сайт — идва преди всякаква сесия.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, phone, email, city, property_kind, service, message } = body;

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

    // Полетата идват от публична форма — emailLayout ги екранира.
    sendEmail({
      to: (await getNotifyEmail()) || "",
      subject: `Ново запитване от ${full_name.trim().slice(0, 80)}`,
      html: emailLayout({
        title: "Ново запитване",
        rows: [
          ["Име", full_name.trim()],
          ["Имейл", email.trim()],
          ["Телефон", phone],
          ["Град", city],
          ["Вид имот", property_kind],
          ["Услуга", service],
          ["Съобщение", message],
        ],
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true, id: record.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inquiries error:", error);
    return NextResponse.json({ error: "Грешка при изпращане на запитване" }, { status: 500 });
  }
}
