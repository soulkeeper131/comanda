import { setSetting } from "@/lib/settings";
import { billBankPlans } from "@/lib/subscriptions";
import { db } from "@/db";
import { offers, findings, properties, jobs, payments, plans } from "@/db/schema";
import { and, eq, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import { generateAll, todaySofia } from "@/lib/jobs-generator";
import { formatEur } from "@/lib/mail-layout";
import { bankRows, notify, propertyLink } from "@/lib/messages";
import { bankReference, formatDateOnly } from "@/lib/format";
import { addDays } from "@/lib/domain/plans";
import { dueOfferReminder, duePaymentReminder, offerPrepay } from "@/lib/domain/offers";
import { getPrepayThreshold } from "@/lib/settings";

/** Изтекли оферти → "expired"; констатацията пак може да поиска оферта. Клиентът и екипът знаят. */
export async function expireOffers(now = new Date()): Promise<number> {
  const stale = db
    .select({ offer: offers, finding_title: findings.title, property_id: properties.id, property_name: properties.name, owner_id: properties.owner_id })
    .from(offers)
    .innerJoin(findings, eq(offers.finding_id, findings.id))
    .innerJoin(properties, eq(findings.property_id, properties.id))
    .where(and(eq(offers.decision, "pending"), lte(offers.expires_at, now.toISOString())))
    .all();
  if (stale.length === 0) return 0;
  db.update(offers).set({ decision: "expired" }).where(inArray(offers.id, stale.map((o) => o.offer.id))).run();
  db.update(findings)
    .set({ status: "open" })
    .where(and(inArray(findings.id, stale.map((o) => o.offer.finding_id)), eq(findings.status, "quoted")))
    .run();
  for (const row of stale) {
    const vars = { title: row.finding_title, property: row.property_name, amount: formatEur(row.offer.price) };
    await notify("offer_expired", { to: row.owner_id, vars, link: propertyLink(row.property_id) });
    await notify("offer_expired_team", { to: "admins", vars });
  }
  return stale.length;
}

function offerRows(decision: "pending" | "done" | "accepted") {
  return db
    .select({
      offer: offers,
      finding_title: findings.title,
      property_id: properties.id,
      property_name: properties.name,
      owner_id: properties.owner_id,
    })
    .from(offers)
    .innerJoin(findings, eq(offers.finding_id, findings.id))
    .innerJoin(properties, eq(findings.property_id, properties.id))
    .where(eq(offers.decision, decision))
    .all();
}

/** Напомняния за оферти без отговор — ден 3 и ден 6 (въпрос 21). */
export async function remindPendingOffers(now = new Date()): Promise<number> {
  let sent = 0;
  for (const row of offerRows("pending")) {
    const o = row.offer;
    if (!o.sent_at) continue;
    const due = dueOfferReminder(o.sent_at, o.reminders_sent ?? 0, now);
    if (!due) continue;
    // Първо отбелязваме — ако скриптът падне по средата, не пращаме два пъти.
    db.update(offers).set({ reminders_sent: due }).where(eq(offers.id, o.id)).run();
    await notify("offer_reminder", {
      to: row.owner_id,
      vars: { title: row.finding_title, property: row.property_name, until: formatDateOnly(o.expires_at) },
      rows: [["Цена", formatEur(o.price)]],
      link: propertyLink(row.property_id),
    });
    sent++;
  }
  return sent;
}

/**
 * Неплатена работа — ден 3, 7 и 14 (въпрос 22б): завършен ремонт с
 * плащане след работата, и приет ремонт, който чака предплащане.
 * Системата не спира услуги — само напомня; екипът вижда неплатените на таблото.
 */
export async function remindUnpaidOffers(now = new Date()): Promise<number> {
  const threshold = getPrepayThreshold();
  let sent = 0;
  for (const row of offerRows("done")) {
    const o = row.offer;
    if (offerPrepay(o, threshold) || !o.done_at) continue;
    const due = duePaymentReminder(o.done_at, o.payment_reminders_sent ?? 0, now);
    if (!due) continue;
    db.update(offers).set({ payment_reminders_sent: due }).where(eq(offers.id, o.id)).run();
    await notify("repair_unpaid_reminder", {
      to: row.owner_id,
      vars: { title: row.finding_title, property: row.property_name, date: formatDateOnly(o.done_at), amount: formatEur(o.price) },
      link: propertyLink(row.property_id),
    });
    sent++;
  }
  for (const row of offerRows("accepted")) {
    const o = row.offer;
    if (!offerPrepay(o, threshold) || !o.decided_at) continue;
    const due = duePaymentReminder(o.decided_at, o.payment_reminders_sent ?? 0, now);
    if (!due) continue;
    db.update(offers).set({ payment_reminders_sent: due }).where(eq(offers.id, o.id)).run();
    await notify("offer_prepay_reminder", {
      to: row.owner_id,
      vars: { title: row.finding_title, property: row.property_name, amount: formatEur(o.price) },
      rows: bankRows(bankReference("offer", o.id), o.price),
      link: propertyLink(row.property_id),
    });
    sent++;
  }
  return sent;
}

/** „Утре е обход" — веднъж за всеки планиран обход, денят преди него. */
export async function remindVisitsTomorrow(today: string): Promise<number> {
  const tomorrow = addDays(today, 1);
  const due = db
    .select({ job: jobs, property_name: properties.name, owner_id: properties.owner_id })
    .from(jobs)
    .innerJoin(properties, eq(jobs.property_id, properties.id))
    .where(and(eq(jobs.status, "planned"), isNull(jobs.reminder_sent_at), gte(jobs.planned_at, tomorrow), lt(jobs.planned_at, addDays(tomorrow, 1))))
    .all();
  for (const row of due) {
    db.update(jobs).set({ reminder_sent_at: new Date().toISOString() }).where(eq(jobs.id, row.job.id)).run();
    await notify("visit_tomorrow", {
      to: row.owner_id,
      vars: { property: row.property_name, date: formatDateOnly(row.job.planned_at) },
      link: propertyLink(row.job.property_id),
    });
  }
  return due.length;
}

/**
 * Абонамент по банка с изтекъл платен период и непоявил се превод —
 * напомняне на 1-ия и 7-ия ден (обходите продължават; екипът вижда
 * абонамента в „Абонаменти без плащане").
 */
export async function remindOverduePlans(today: string): Promise<number> {
  const rows = db
    .select({ payment: payments, plan: plans, property_name: properties.name, property_id: properties.id, owner_id: properties.owner_id })
    .from(payments)
    .innerJoin(plans, eq(payments.plan_id, plans.id))
    .innerJoin(properties, eq(plans.property_id, properties.id))
    .where(and(eq(payments.status, "pending"), eq(payments.method, "bank"), inArray(plans.status, ["requested", "active"])))
    .all();
  let sent = 0;
  for (const row of rows) {
    const paidUntil = row.plan.paid_until;
    if (!paidUntil || paidUntil >= today) continue;
    const daysLate = Math.round((Date.parse(today) - Date.parse(paidUntil)) / 86_400_000);
    const done = row.payment.reminders_sent ?? 0;
    const next = done === 0 && daysLate >= 1 ? 1 : done === 1 && daysLate >= 7 ? 2 : 0;
    if (!next) continue;
    db.update(payments).set({ reminders_sent: next }).where(eq(payments.id, row.payment.id)).run();
    await notify("plan_overdue", {
      to: row.owner_id,
      vars: { property: row.property_name, paid_until: formatDateOnly(paidUntil), amount: formatEur(row.payment.amount) },
      rows: bankRows(bankReference("plan", row.plan.id), row.payment.amount),
      link: propertyLink(row.property_id),
    });
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
  visit_reminders: number;
  plan_overdue_reminders: number;
};

/** Един скрипт: генериране, изтичане, напомняния, преводи за абонаментите. */
export async function runPeriodic(now = new Date()): Promise<PeriodicResult> {
  const today = todaySofia(now);
  const gen = generateAll(today);
  const expired = await expireOffers(now);
  const offerReminders = await remindPendingOffers(now);
  const paymentReminders = await remindUnpaidOffers(now);
  const planBank = await billBankPlans(today);
  const visitReminders = await remindVisitsTomorrow(today);
  const overdue = await remindOverduePlans(today);
  // За панела „Готовност": кога периодичните задачи са минали за последно.
  setSetting("periodic_last_run", new Date().toISOString());
  return {
    today,
    plans: gen.plans,
    jobs_created: gen.created,
    offers_expired: expired,
    offer_reminders: offerReminders,
    payment_reminders: paymentReminders,
    plan_bank_payments: planBank,
    visit_reminders: visitReminders,
    plan_overdue_reminders: overdue,
  };
}
