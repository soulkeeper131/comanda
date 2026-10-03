import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-inv-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
fs.cpSync(path.join(process.cwd(), "assets"), path.join(dir, "assets"), { recursive: true });
const cwd = process.cwd();
process.chdir(dir);

let db: typeof import("@/db")["db"];
let s: typeof import("@/db/schema");
let pay: typeof import("@/lib/payments");
let pdf: typeof import("@/lib/invoice-pdf");

beforeAll(async () => {
  ({ db } = await import("@/db"));
  s = await import("@/db/schema");
  pay = await import("@/lib/payments");
  pdf = await import("@/lib/invoice-pdf");
  db.insert(s.organizations).values({ id: "o", name: "K" }).run();
  db.insert(s.users).values({
    id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client",
    full_name: "Иван Петров", company_name: "Петров ЕООД", eik: "204000000", billing_address: "гр. София, ул. Пример 1",
  }).run();
  db.insert(s.payments).values({ id: "p1", user_id: "c", amount: 60, method: "bank", status: "paid", paid_at: "2026-10-02T10:00:00Z" }).run();
});

describe("фактура по ЗДДС", () => {
  it("ДДС се разделя от брутната сума без загуба на стотинка", () => {
    expect(pdf.splitVat(60)).toEqual({ base: 50, vat: 10 });
    const { base, vat } = pdf.splitVat(95);
    expect(base + vat).toBeCloseTo(95, 2);
  });

  it("PDF с адреса на получателя; с и без ДДС регистрация", () => {
    const inv = pay.ensureInvoice("p1", "Абонамент Пълен надзор — Имот")!;
    expect(inv.buyer_address).toBe("гр. София, ул. Пример 1");
    delete process.env.COMPANY_VAT;
    process.env.COMPANY_NAME = "Ко Манда ЕООД";
    const plain = pdf.renderInvoicePdf(inv.id)!;
    process.env.COMPANY_VAT = "BG204111111";
    const vat = pdf.renderInvoicePdf(inv.id)!;
    expect(plain.buffer.length).toBeGreaterThan(10_000);
    expect(plain.filename).toBe(`faktura-${inv.number}.pdf`);
    if (process.env.DUMP_PDF) {
      fs.writeFileSync(path.join(cwd, process.env.DUMP_PDF, "inv-novat.pdf"), plain.buffer);
      fs.writeFileSync(path.join(cwd, process.env.DUMP_PDF, "inv-vat.pdf"), vat.buffer);
    }
  });
});
