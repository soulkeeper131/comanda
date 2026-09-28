import { billBankPlans } from "@/lib/subscriptions";
import { db } from "@/db";
import { offers, findings, properties } from "@/db/schema";
import { and, eq, inArray, lte } from "drizzle-orm";
import { generateAll, todaySofia } from "@/lib/jobs-generator";
import { sendEmail, getNotifyEmail, ownerEmailFor } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";
import { emailLayout, formatEur } from "@/lib/mail-layout";
import { dueOfferReminder, duePaymentReminder, offerPrepay } from "@/lib/domain/offers";
import { getPrepayThreshold } from "@/lib/settings";

/** Изтекли оферти → "expired"; констатацията пак може да поиска оферта. */
export function expireOffers(now = new Date()): number {
  const stale = db
    .select({ id: offers.id, finding_id: offers.finding_id })
    .from(offers)
    .where(and(eq(offers.decision, "pending"), lte(offers.expires_at, now.toISOString())))
    .all();
  if (stale.length === 0) return 0;
  db.update(offers).set({ decision: "expired" }).where(inArray(offers.id, stale.map((o) => o.id))).run();
  db.update(findings)
    .set({ status: "open" })
    .where(and(inArray(findings.id, stale.map((o) => o.finding_id)), eq(findings.status, "quoted")))
    .run();
  return stale.length;
}

function offerRows(decision: "pending" | "done") {
  return db
    .select({ offer: offers, finding_title: findings.title, property_id: properties.id, property_name: properties.name })
    .from(offers)
    .innerJoin(findings, eq(offers.finding_id, findings.id))
    .innerJoin(properties, eq(findings.property_id, properties.id))
    .where(eq(offers.decision, decision))
    .all();
}

/** Напомняния за оферти без отговор — ден 3 и ден 6 (въпрос 21). */
export function remindPendingOffers(now = new Date()): number {
  let sent = 0;
  for (const row of offerRows("pending")) {
    const o = row.offer;
    if (!o.sent_at) continue;
    const due = dueOfferReminder(o.sent_at, o.reminders_sent ?? 0, now);
    if (!due) continue;
    const until = o.expires_at ? new Date(o.expires_at).toLocaleDateString("bg-BG") : "";
    const email = ownerEmailFor(row.property_id);
    if (email) {
      sendEmail({
        to: email,
        subject: `Офертата за ${row.property_name} чака отговор`,
        html: emailLayout({
          title: "Офертата чака вашия отговор",
          intro: `Офертата е валидна до <strong>${until}</strong>. След това изтича и трябва да се поиска нова.`,
          rows: [
            ["Имот", row.property_name],
            ["Проблем", row.finding_title],
            ["Цена", formatEur(o.price)],
          ],
          cta: { label: "Отговори на офертата" },
        }),
      }).catch(() => {});
    }
    notifyOwner(row.property_id, "offer_new", "Офертата чака отговор", `${row.finding_title} — валидна до ${until}`, "/dashboard");
    db.update(offers).set({ reminders_sent: due }).where(eq(offers.id, o.id)).run();
    sent++;
  }
  return sent;
}

/**
 * Неплатена завършена работа (плащане след работата, под прага) — ден 3,
 * 7 и 14 (въпрос 22б). Системата не спира услуги — само напомня.
 */
export async function remindUnpaidOffers(now = new Date()): Promise<number> {
  const threshold = getPrepayThreshold();
  let sent = 0;
  const notify = await getNotifyEmail();
  for (const row of offerRows("done")) {
    const o = row.offer;
    if (offerPrepay(o, threshold) || !o.done_at) continue;
    const due = duePaymentReminder(o.done_at, o.payment_reminders_sent ?? 0, now);
    if (!due) continue;
    const html = emailLayout({
      title: "Напомняне за плащане",
      intro: "Ремонтът е завършен. Благодарим, ако вече сте платили — тогава просто игнорирайте това писмо.",
      rows: [
        ["Имот", row.property_name],
        ["Ремонт", row.finding_title],
        ["Сума", formatEur(o.price)],
        ["Завършен на", new Date(o.done_at).toLocaleDateString("bg-BG")],
      ],
      cta: { label: "Плати" },
    });
    const email = ownerEmailFor(row.property_id);
    if (email) sendEmail({ to: email, subject: `Напомняне за плащане: ${row.finding_title}`, html }).catch(() => {});
    if (notify) {
      sendEmail({ to: notify, subject: `Неплатено (${due}-во напомняне): ${row.property_name} — ${formatEur(o.price)}`, html }).catch(() => {});
    }
    db.update(offers).set({ payment_reminders_sent: due }).where(eq(offers.id, o.id)).run();
    sent++;
  }
  return sent;
}

export type PeriodicResult = {
  today: string;
  plans: number;
  jobs_created: number;
  offers_expired: number;
  offer_reminders: number;
  payment_reminders: number;
  plan_bank_payments: number;
};

/** Един скрипт: генериране, изтичане, напомняния, преводи за абонаментите. */
export async function runPeriodic(now = new Date()): Promise<PeriodicResult> {
  const today = todaySofia(now);
  const gen = generateAll(today);
  const expired = expireOffers(now);
  const offerReminders = remindPendingOffers(now);
  const paymentReminders = await remindUnpaidOffers(now);
  const planBank = await billBankPlans(today);
  return {
    today,
    plans: gen.plans,
    jobs_created: gen.created,
    offers_expired: expired,
    offer_reminders: offerReminders,
    payment_reminders: paymentReminders,
    plan_bank_payments: planBank,
  };
}
