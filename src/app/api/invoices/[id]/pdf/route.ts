import { db } from "@/db";
import { invoices, users, payments } from "@/db/schema";
import { withAuth, isAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const dynamic = "force-dynamic";

// GET /api/invoices/[id]/pdf — генерира PDF фактура
export const GET = withAuth({}, async (_request, { session, params }) => {
  const invoice = db
    .select()
    .from(invoices)
    .where(eq(invoices.id, params.id))
    .get();

  if (!invoice) {
    return NextResponse.json(
      { error: "Фактурата не е намерена" },
      { status: 404 }
    );
  }

  // Само собственикът на фактурата или admin може да я свали.
  // 404, не 403 — не издаваме, че фактурата съществува.
  if (invoice.user_id !== session.uid && !isAdmin(session)) {
    return NextResponse.json(
      { error: "Фактурата не е намерена" },
      { status: 404 }
    );
  }

  // Вземи данни за клиента
  const user = db
    .select({
      full_name: users.full_name,
      email: users.email,
      phone: users.phone,
      company_name: users.company_name,
      eik: users.eik,
      vat_number: users.vat_number,
    })
    .from(users)
    .where(eq(users.id, invoice.user_id))
    .get();

  // Вземи плащане ако има
  let payment: any = null;
  if (invoice.payment_id) {
    payment = db
      .select()
      .from(payments)
      .where(eq(payments.id, invoice.payment_id))
      .get();
  }

  // ============================================================
  // Генериране на PDF
  // ============================================================
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // --- Бранд цветове ---
  const brandPrimary = [27, 152, 224] as [number, number, number]; // #1b98e0
  const brandDark = [0, 100, 148] as [number, number, number]; // #006494
  const brandSecondary = [36, 123, 160] as [number, number, number]; // #247ba0
  const brandBg = [232, 241, 242] as [number, number, number]; // #e8f1f2

  // --- Header ---
  doc.setFontSize(20);
  doc.setTextColor(...brandDark);
  doc.text("КОМАНДА", pageWidth / 2, y, { align: "center" });
  y += 9;

  doc.setFontSize(14);
  doc.setTextColor(...brandPrimary);
  doc.text(`Фактура \u2116${invoice.number}`, pageWidth / 2, y, {
    align: "center",
  });
  y += 12;

  // --- Дата на издаване ---
  const issueDate = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString("bg-BG", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : new Date().toLocaleDateString("bg-BG");

  doc.setFontSize(10);
  doc.setTextColor(...brandSecondary);
  doc.text(`Дата на издаване: ${issueDate}`, 14, y);
  y += 7;

  // Номер на фактура (отново като поле)
  doc.text(`Номер: ${invoice.number}`, 14, y);
  y += 10;

  // --- Разделител ---
  doc.setDrawColor(228, 233, 240);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // --- Данни за клиента ---
  doc.setFontSize(12);
  doc.setTextColor(...brandDark);
  doc.text("Данни за клиента", 14, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(...brandSecondary);

  if (user) {
    doc.text(`Име: ${user.full_name || "—"}`, 14, y);
    y += 5;
    doc.text(`Имейл: ${user.email || "—"}`, 14, y);
    y += 5;

    if (user.company_name) {
      doc.text(`Фирма: ${user.company_name}`, 14, y);
      y += 5;
    }
    if (user.eik) {
      doc.text(`ЕИК: ${user.eik}`, 14, y);
      y += 5;
    }
    if (user.vat_number) {
      doc.text(`ДДС номер: ${user.vat_number}`, 14, y);
      y += 5;
    }
  } else {
    doc.text("Клиент #" + invoice.user_id.slice(0, 8), 14, y);
    y += 5;
  }

  y += 8;

  // --- Разделител ---
  doc.setDrawColor(228, 233, 240);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // --- Таблица с артикули ---
  doc.setFontSize(12);
  doc.setTextColor(...brandDark);
  doc.text("Артикули / Услуги", 14, y);
  y += 6;

  // Определяме описанието и сумата
  const description =
    invoice.description ||
    payment?.description ||
    user?.company_name ||
    "Услуга по договор";

  const amount = invoice.amount ?? payment?.amount ?? 0;

  const tableData = [
    [
      "1",
      description,
      "1",
      `${amount.toFixed(2)} лв`,
      `${amount.toFixed(2)} лв`,
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["№", "Описание", "К-во", "Ед. цена", "Общо"]],
    body: tableData,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [0, 100, 148],
    },
    headStyles: {
      fillColor: brandPrimary,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: brandBg,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // --- Обща сума ---
  doc.setDrawColor(27, 152, 224);
  doc.setFillColor(232, 241, 242);
  doc.roundedRect(pageWidth - 80, y, 66, 18, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setTextColor(...brandDark);
  doc.text("Обща сума:", pageWidth - 76, y + 7);
  doc.setFontSize(13);
  doc.setTextColor(...brandPrimary);
  doc.text(`${amount.toFixed(2)} лв`, pageWidth - 18, y + 7, {
    align: "right",
  });
  y += 25;

  // --- Плащане (ако има) ---
  if (payment) {
    doc.setFontSize(10);
    doc.setTextColor(...brandSecondary);
    const methodLabel =
      payment.method === "card"
        ? "Карта"
        : payment.method === "transfer"
          ? "Банков превод"
          : payment.method || "—";
    doc.text(`Метод на плащане: ${methodLabel}`, 14, y);
    y += 5;

    const statusLabel =
      payment.status === "paid"
        ? "Платено"
        : payment.status === "pending"
          ? "Чакащо"
          : payment.status || "—";
    doc.text(`Статус: ${statusLabel}`, 14, y);
    y += 5;

    if (payment.paid_at) {
      const paidDate = new Date(payment.paid_at).toLocaleDateString("bg-BG");
      doc.text(`Платено на: ${paidDate}`, 14, y);
      y += 5;
    }
    y += 5;
  }

  // --- Footer с данни на фирмата ---
  const footerY = doc.internal.pageSize.getHeight() - 35;

  doc.setDrawColor(228, 233, 240);
  doc.line(14, footerY, pageWidth - 14, footerY);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Ко Манда ЕООД", pageWidth / 2, footerY + 6, { align: "center" });
  doc.text("ЕИК: 123456789 | ДДС: BG123456789", pageWidth / 2, footerY + 11, {
    align: "center",
  });
  doc.text("София, ул. Примерна 1 | comanda.blv.bg", pageWidth / 2, footerY + 16, {
    align: "center",
  });
  doc.text(
    `Генериран на ${new Date().toLocaleDateString("bg-BG")} от Ко Манда`,
    pageWidth / 2,
    footerY + 21,
    { align: "center" }
  );

  // --- Връщане на PDF ---
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `faktura-${invoice.number}.pdf`;

  // Uint8Array, не суров Buffer — консистентно с останалите PDF/файлови routes.
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length.toString(),
    },
  });
});
