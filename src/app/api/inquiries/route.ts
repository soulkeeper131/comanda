import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

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
      .returning();

    // Send email notification
    sendEmail({
      to: (await getNotifyEmail()) || "",
      subject: `📩 Ново запитване от ${full_name.trim()}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1b98e0;">📩 Ново запитване</h2>
          <p style="color: #247ba0;"><strong>Име:</strong> ${full_name.trim()}</p>
          <p style="color: #247ba0;"><strong>Имейл:</strong> ${email.trim()}</p>
          ${phone ? `<p style="color: #247ba0;"><strong>Телефон:</strong> ${phone}</p>` : ""}
          ${city ? `<p style="color: #247ba0;"><strong>Град:</strong> ${city}</p>` : ""}
          ${service ? `<p style="color: #247ba0;"><strong>Услуга:</strong> ${service}</p>` : ""}
          ${message ? `<p style="color: #247ba0;"><strong>Съобщение:</strong> ${message}</p>` : ""}
          <hr style="border: none; border-top: 1px solid #e4e9f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Ко Манда — comanda.blv.bg</p>
        </div>
      `,
    }).catch(() => {});

    return NextResponse.json({ success: true, id: record.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inquiries error:", error);
    return NextResponse.json({ error: "Грешка при изпращане на запитване" }, { status: 500 });
  }
}
