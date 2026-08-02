import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { NextResponse } from "next/server";

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

    return NextResponse.json({ success: true, id: record.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inquiries error:", error);
    return NextResponse.json({ error: "Грешка при изпращане на запитване" }, { status: 500 });
  }
}
