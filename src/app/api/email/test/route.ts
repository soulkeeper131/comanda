import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/email/test — sends a test email to the configured notify email
export const POST = withAuth({ role: ["admin"] }, async () => {
  try {
    const notifyEmail = await getNotifyEmail();

    if (!notifyEmail) {
      return NextResponse.json(
        { error: "Няма конфигуриран имейл за известия. Моля, задайте SMTP настройки първо." },
        { status: 400 }
      );
    }

    await sendEmail({
      to: notifyEmail,
      subject: "🧪 Тестов имейл от Ко Манда",
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #006494;">✅ SMTP работи!</h2>
          <p style="color: #247ba0;">Това е тестов имейл от <strong>Ко Манда</strong>.</p>
          <p style="color: #247ba0;">Ако виждате това, имейл известията са конфигурирани успешно.</p>
          <hr style="border: none; border-top: 1px solid #e4e9f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Изпратено на ${new Date().toLocaleString("bg-BG")}</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: "Тестовият имейл е изпратен успешно" });
  } catch (error: any) {
    console.error("POST /api/email/test error:", error);
    return NextResponse.json(
      { error: `Грешка при изпращане на тестов имейл: ${error.message}` },
      { status: 500 }
    );
  }
});
