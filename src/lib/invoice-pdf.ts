import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments, users } from "@/db/schema";
import { companyInfo } from "@/lib/legal";
import { appHost } from "@/lib/mail-layout";
import { PDF_FONT, applyCyrillicFont } from "@/lib/pdf-fonts";

/** Цените са с включен ДДС; регистриран доставчик показва основата отделно. */
export const VAT_RATE = 0.2;

export function splitVat(gross: number): { base: number; vat: number } {
  const base = Math.round((gross / (1 + VAT_RATE)) * 100) / 100;
  return { base, vat: Math.round((gross - base) * 100) / 100 };
}

const DARK: [number, number, number] = [0, 100, 148];
const PRIMARY: [number, number, number] = [27, 152, 224];
const TEXT: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];

const day = (iso: string | null | undefined) => {
  if (!iso) return "";
  // SQLite datetime('now') е "YYYY-MM-DD HH:MM:SS" в UTC
  const d = new Date(/^\d{4}-\d{2}-\d{2} /.test(iso) ? iso.replace(" ", "T") + "Z" : iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Sofia" });
};
const eur = (n: number) => `${n.toFixed(2)} €`;

/**
 * Фактура / кредитно известие като PDF — реквизитите по чл. 114 ЗДДС:
 * вид и номер (10 цифри), дата на издаване и на данъчното събитие,
 * доставчик и получател (име, адрес, ЕИК, ДДС №), услуга, количество,
 * единична цена и данъчна основа, ставка и размер на ДДС или основание
 * за неначисляване. Данните на получателя са тези към датата на издаване.
 *
 * null — няма такава фактура.
 */
export function renderInvoicePdf(invoiceId: string): { buffer: Buffer; filename: string } | null {
  const invoice = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
  if (!invoice) return null;
  const payment = invoice.payment_id ? db.select().from(payments).where(eq(payments.id, invoice.payment_id)).get() : undefined;
  const credit = invoice.credit_for
    ? db.select({ number: invoices.number, created_at: invoices.created_at }).from(invoices).where(eq(invoices.id, invoice.credit_for)).get()
    : undefined;
  // Стари фактури без снимка на купувача — текущите данни на профила.
  const live = db.select().from(users).where(eq(users.id, invoice.user_id)).get();
  const snap = invoice.buyer_name !== null || invoice.buyer_email !== null;
  const buyer = {
    name: snap ? invoice.buyer_name : live?.full_name ?? null,
    email: snap ? invoice.buyer_email : live?.email ?? null,
    company: snap ? invoice.buyer_company : live?.company_name ?? null,
    eik: snap ? invoice.buyer_eik : live?.eik ?? null,
    vat: snap ? invoice.buyer_vat : live?.vat_number ?? null,
    address: snap ? invoice.buyer_address : live?.billing_address ?? null,
  };
  const company = companyInfo();
  const isCredit = !!invoice.credit_for;
  const gross = invoice.amount ?? payment?.amount ?? 0;
  const vatRegistered = !!company.vat;
  const { base, vat } = vatRegistered ? splitVat(gross) : { base: gross, vat: 0 };

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  applyCyrillicFont(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 18;

  // --- Вид, номер, дати ---
  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.text(isCredit ? "КРЕДИТНО ИЗВЕСТИЕ" : "ФАКТУРА", 14, y);
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("ОРИГИНАЛ", W - 14, y, { align: "right" });
  y += 8;
  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`№ ${invoice.number}`, 14, y);
  doc.text(`Дата на издаване: ${day(invoice.created_at)}`, W - 14, y, { align: "right" });
  y += 5;
  doc.text(`Дата на данъчното събитие: ${day(payment?.paid_at ?? invoice.created_at)}`, W - 14, y, { align: "right" });
  if (credit) {
    doc.text(`Към фактура № ${credit.number} от ${day(credit.created_at)}`, 14, y);
  }
  y += 10;

  // --- Доставчик | Получател ---
  const col = (title: string, lines: (string | null | false | undefined)[], x: number) => {
    let yy = y;
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(title, x, yy);
    yy += 5.5;
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT);
    for (const line of lines.filter(Boolean) as string[]) {
      const wrapped = doc.splitTextToSize(line, W / 2 - 22);
      doc.text(wrapped, x, yy);
      yy += 4.8 * wrapped.length;
    }
    return yy;
  };
  const supplierEnd = col(
    "Доставчик",
    [
      company.name || "Данните на доставчика не са настроени (COMPANY_NAME)",
      company.address && `Адрес: ${company.address}`,
      company.eik && `ЕИК: ${company.eik}`,
      company.vat && `ДДС №: ${company.vat}`,
      company.mol && `МОЛ: ${company.mol}`,
    ],
    14,
  );
  const buyerEnd = col(
    "Получател",
    [
      buyer.company || buyer.name || "—",
      buyer.company && buyer.name && `Лице за контакт: ${buyer.name}`,
      buyer.address ? `Адрес: ${buyer.address}` : "Адрес: —",
      buyer.eik && `ЕИК: ${buyer.eik}`,
      buyer.vat && `ДДС №: ${buyer.vat}`,
      buyer.email && `Имейл: ${buyer.email}`,
    ],
    W / 2 + 4,
  );
  y = Math.max(supplierEnd, buyerEnd) + 6;

  // --- Услугата ---
  const unit = vatRegistered ? base : gross;
  autoTable(doc, {
    startY: y,
    head: [["№", "Описание", "Мярка", "К-во", vatRegistered ? "Ед. цена без ДДС" : "Ед. цена", "Стойност"]],
    body: [["1", invoice.description || "Услуга", "бр.", "1", eur(unit), eur(unit)]],
    theme: "grid",
    styles: { font: PDF_FONT, fontSize: 9, cellPadding: 2.5, textColor: TEXT },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 17, halign: "center" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // --- Суми ---
  const total = (label: string, value: string, bold = false) => {
    doc.setFont(PDF_FONT, bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(...(bold ? DARK : TEXT));
    doc.text(label, W - 60, y, { align: "right" });
    doc.text(value, W - 14, y, { align: "right" });
    y += bold ? 7 : 5.5;
  };
  total("Данъчна основа:", eur(base));
  total(vatRegistered ? "ДДС 20%:" : "ДДС:", eur(vat));
  total("Сума за плащане:", eur(gross), true);
  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  if (!vatRegistered) {
    doc.text("Основание за неначисляване на ДДС: чл. 113, ал. 9 от ЗДДС", 14, y);
    y += 5;
  }

  // --- Плащане ---
  if (payment) {
    const method = payment.method === "card" ? "Карта" : payment.method === "bank" || payment.method === "transfer" ? "Банков превод" : payment.method;
    doc.text(`Начин на плащане: ${method}${payment.paid_at && !isCredit ? ` · платено на ${day(payment.paid_at)}` : ""}`, 14, y);
    y += 5;
  }
  if (isCredit) {
    doc.text("Основание: възстановена сума по фактурата, към която е издадено известието.", 14, y);
    y += 5;
  }

  // --- Долу: контакт на доставчика ---
  doc.setDrawColor(228, 233, 240);
  doc.line(14, H - 22, W - 14, H - 22);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text([company.name, company.email, company.phone, appHost()].filter(Boolean).join(" · "), W / 2, H - 16, { align: "center" });
  doc.text("Документът е издаден електронно.", W / 2, H - 11, { align: "center" });

  return {
    buffer: Buffer.from(doc.output("arraybuffer")),
    filename: `${isCredit ? "kreditno-izvestie" : "faktura"}-${invoice.number}.pdf`,
  };
}
