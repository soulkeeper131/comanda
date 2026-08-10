import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/email/send — send an email with {to, subject, html}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 }
      );
    }

    await sendEmail({ to, subject, html });

    return NextResponse.json({ success: true, message: "Email sent" });
  } catch (error: any) {
    console.error("POST /api/email/send error:", error);
    return NextResponse.json(
      { error: `Failed to send email: ${error.message}` },
      { status: 500 }
    );
  }
}
