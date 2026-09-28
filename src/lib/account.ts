import { randomBytes } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  authTokens,
  evidence,
  findingPhotos,
  findings,
  inquiries,
  invoices,
  jobItems,
  jobReschedules,
  jobs,
  notifications,
  offerPhotos,
  offers,
  payments,
  plans,
  properties,
  pushSubscriptions,
  serviceOrders,
  uploads,
  users,
  zones,
} from "@/db/schema";
import { isLivePlan } from "@/lib/domain/plans";
import { removePlannedJobsAfter, todaySofia } from "@/lib/jobs-generator";
import { getStripeOrNull } from "@/lib/stripe";
import { cancelStripeSubscription } from "@/lib/subscriptions";
import { cancelPlan } from "@/lib/plan-cancel";
import { expireCheckoutSession } from "@/lib/stripe";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

function ownData(userId: string) {
  const props = db.select().from(properties).where(eq(properties.owner_id, userId)).all();
  const propIds = props.map((p) => p.id);
  const inProps = <T>(rows: () => T[]) => (propIds.length ? rows() : []);
  const jobRows = inProps(() => db.select().from(jobs).where(inArray(jobs.property_id, propIds)).all());
  const jobIds = jobRows.map((j) => j.id);
  const findingRows = inProps(() => db.select().from(findings).where(inArray(findings.property_id, propIds)).all());
  const findingIds = findingRows.map((f) => f.id);
  const offerRows = findingIds.length ? db.select().from(offers).where(inArray(offers.finding_id, findingIds)).all() : [];
  return { props, propIds, jobRows, jobIds, findingRows, findingIds, offerRows };
}

const photoUrl = (storagePath: string) => `/api/photos/${path.basename(storagePath)}`;

/**
 * Право на достъп и преносимост (чл. 15 и 20 GDPR): всичко за клиента в
 * машинночетим вид. Без пароли, токени и вътрешни бележки на екипа.
 */
export function exportAccount(userId: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;
  const { props, propIds, jobRows, jobIds, findingRows, findingIds, offerRows } = ownData(userId);

  const items = jobIds.length ? db.select().from(jobItems).where(inArray(jobItems.job_id, jobIds)).all() : [];
  const photos = jobIds.length ? db.select().from(evidence).where(inArray(evidence.job_id, jobIds)).all() : [];
  const fPhotos = findingIds.length ? db.select().from(findingPhotos).where(inArray(findingPhotos.finding_id, findingIds)).all() : [];

  return {
    exported_at: new Date().toISOString(),
    profile: {
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      company_name: user.company_name,
      eik: user.eik,
      vat_number: user.vat_number,
      email_verified_at: user.email_verified_at,
      terms_accepted_at: user.terms_accepted_at,
      terms_version: user.terms_version,
      created_at: user.created_at,
    },
    properties: props.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      kind: p.kind,
      access_notes: p.access_notes,
      contact_name: p.contact_name,
      contact_phone: p.contact_phone,
      status: p.status,
      created_at: p.created_at,
      zones: db.select({ name: zones.name }).from(zones).where(eq(zones.property_id, p.id)).all().map((z) => z.name),
    })),
    plans: propIds.length ? db.select().from(plans).where(inArray(plans.property_id, propIds)).all() : [],
    visits: jobRows.map((j) => ({
      id: j.id,
      property_id: j.property_id,
      title: j.title,
      status: j.status,
      planned_at: j.planned_at,
      check_in: j.check_in,
      check_out: j.check_out,
      steps: items
        .filter((i) => i.job_id === j.id)
        .map((i) => ({ zone: i.zone_label, label: i.label, done: i.done, note: i.note })),
      photos: photos.filter((p) => p.job_id === j.id).map((p) => ({ url: photoUrl(p.storage_path), taken_at: p.taken_at })),
    })),
    reschedules: db.select().from(jobReschedules).where(eq(jobReschedules.user_id, userId)).all(),
    findings: findingRows.map((f) => ({
      id: f.id,
      property_id: f.property_id,
      title: f.title,
      body: f.body,
      severity: f.severity,
      status: f.status,
      created_at: f.created_at,
      photos: fPhotos.filter((p) => p.finding_id === f.id).map((p) => ({ url: photoUrl(p.storage_path), taken_at: p.taken_at })),
    })),
    offers: offerRows,
    service_orders: db.select().from(serviceOrders).where(eq(serviceOrders.requested_by, userId)).all(),
    payments: db.select().from(payments).where(eq(payments.user_id, userId)).all(),
    invoices: db
      .select({ number: invoices.number, amount: invoices.amount, description: invoices.description, created_at: invoices.created_at })
      .from(invoices)
      .where(eq(invoices.user_id, userId))
      .all(),
    notifications: db.select().from(notifications).where(eq(notifications.user_id, userId)).all(),
    inquiries: db.select().from(inquiries).where(eq(inquiries.email, user.email)).all(),
  };
}

/**
 * Какво спира изтриването — неща, при които изчезналият имейл значи загубени
 * пари или недовършена работа за клиента. null = може.
 */
export function deletionBlocker(userId: string): string | null {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return "Профилът не е намерен.";
  if (user.role !== "client") return "Служебните профили се закриват от администратор.";
  const { jobRows } = ownData(userId);
  if (jobRows.some((j) => j.status === "in_progress")) {
    return "В момента тече обход на ваш имот. Опитайте, след като приключи.";
  }
  const owed = db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.user_id, userId), eq(payments.status, "refund_needed")))
    .get();
  if (owed) return "Дължим ви връщане на сума. Ще ви пишем, щом е преведена — след това профилът може да се изтрие.";
  const paidAhead = db
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.requested_by, userId), eq(serviceOrders.status, "paid"), gte(serviceOrders.requested_date, todaySofia())))
    .get();
  if (paidAhead) return "Имате платена предстояща услуга. Пишете ни, за да я откажем и върнем сумата.";
  const { offerRows } = ownData(userId);
  if (offerRows.some((o) => o.decision === "accepted" || o.decision === "paid" || o.decision === "in_progress")) {
    return "Имате приет ремонт, който още не е приключил. Изтриването е възможно след него.";
  }
  if (offerRows.some((o) => o.decision === "done")) {
    return "Имате завършен ремонт, който още не е платен. Платете го или ни пишете.";
  }
  return null;
}

function removePhoto(storagePath: string) {
  const file = path.join(PHOTOS_DIR, path.basename(storagePath));
  try {
    if (existsSync(file)) unlinkSync(file);
  } catch (err) {
    console.error("[account] photo delete failed:", file, err);
  }
}

/**
 * Право на изтриване (чл. 17 GDPR). Профилът се анонимизира, не се трие
 * физически: плащанията и фактурите се пазят 10 години (Закон за
 * счетоводството), затова името и фирмените данни остават само ако има
 * издадени фактури. Всичко останало — имейл, телефон, адреси, достъп до
 * имотите, снимки, известия — изчезва веднага.
 */
export async function deleteAccount(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const blocker = deletionBlocker(userId);
  if (blocker) return { ok: false, error: blocker };
  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  const { propIds, jobIds, findingIds, offerRows } = ownData(userId);
  const today = todaySofia();

  // 1. Абонаментите спират веднага — и в Stripe, за да не се тегли повече.
  const livePlans = propIds.length
    ? db.select().from(plans).where(inArray(plans.property_id, propIds)).all().filter((p) => isLivePlan(p, today))
    : [];
  // Същият път като бутона „Прекратяване": без обслужване → за връщане
  // (админите са известени), иначе до края на платения период.
  for (const plan of livePlans.filter((p) => p.status !== "cancelled")) {
    const res = await cancelPlan(plan.id, { byAdmin: false });
    if (!res.ok) return { ok: false, error: res.error };
  }
  // Спира веднага и тегленето за вече отказаните, които още тече периодът им.
  for (const plan of livePlans) {
    try {
      await cancelStripeSubscription(plan.id, true);
    } catch (err) {
      console.error("[account] Stripe cancel failed:", err);
    }
  }
  // Недовършени плащания с карта — страниците им в Stripe се затварят.
  const openCard = db
    .select()
    .from(payments)
    .where(and(eq(payments.user_id, userId), eq(payments.status, "pending")))
    .all();
  for (const p of openCard) await expireCheckoutSession(p.stripe_session_id);
  if (user.stripe_customer_id) {
    // Картите и контактите в Stripe; плащанията остават там за счетоводството.
    try {
      await getStripeOrNull()?.customers.del(user.stripe_customer_id);
    } catch (err) {
      console.error("[account] Stripe customer delete failed:", err);
    }
  }

  // Файловете се четат преди транзакцията, трият се след нея.
  const files = [
    ...(jobIds.length ? db.select({ p: evidence.storage_path }).from(evidence).where(inArray(evidence.job_id, jobIds)).all() : []),
    ...(findingIds.length
      ? db.select({ p: findingPhotos.storage_path }).from(findingPhotos).where(inArray(findingPhotos.finding_id, findingIds)).all()
      : []),
    ...(offerRows.length
      ? db.select({ p: offerPhotos.storage_path }).from(offerPhotos).where(inArray(offerPhotos.offer_id, offerRows.map((o) => o.id))).all()
      : []),
    ...db.select({ p: uploads.filename }).from(uploads).where(eq(uploads.user_id, userId)).all(),
  ].map((r) => r.p);

  const hasInvoices = !!db.select({ id: invoices.id }).from(invoices).where(eq(invoices.user_id, userId)).get();
  const now = new Date().toISOString();

  db.transaction((tx) => {
    for (const plan of livePlans) {
      // Профилът изчезва — нито един бъдещ обход не остава.
      tx.update(plans).set({ ends_at: today }).where(and(eq(plans.id, plan.id), eq(plans.status, "cancelled"), isNotNull(plans.ends_at))).run();
      removePlannedJobsAfter(plan.id, "0000-00-00", tx);
    }
    tx.update(serviceOrders)
      .set({ status: "cancelled" })
      .where(and(eq(serviceOrders.requested_by, userId), eq(serviceOrders.status, "pending_payment")))
      .run();
    tx.update(payments)
      .set({ status: "cancelled" })
      .where(and(eq(payments.user_id, userId), eq(payments.status, "pending")))
      .run();
    if (propIds.length) {
      tx.update(properties)
        .set({
          name: "Изтрит имот",
          city: null,
          address: null,
          lat: 0,
          lng: 0,
          access_notes: null,
          contact_name: null,
          contact_phone: null,
          archived: true,
          updated_at: now,
        })
        .where(inArray(properties.id, propIds))
        .run();
    }
    tx.delete(pushSubscriptions).where(eq(pushSubscriptions.user_id, userId)).run();
    tx.delete(notifications).where(eq(notifications.user_id, userId)).run();
    tx.delete(authTokens).where(eq(authTokens.user_id, userId)).run();
    tx.delete(inquiries).where(eq(inquiries.email, user.email)).run();
    tx.update(users)
      .set({
        email: `deleted-${userId}@deleted.invalid`,
        phone: null,
        full_name: hasInvoices ? user.full_name : "Изтрит клиент",
        company_name: hasInvoices ? user.company_name : null,
        eik: hasInvoices ? user.eik : null,
        vat_number: hasInvoices ? user.vat_number : null,
        password_hash: bcrypt.hashSync(randomBytes(24).toString("hex"), 4),
        active: false,
        email_verified_at: null,
        stripe_customer_id: null,
        updated_at: now,
      })
      .where(eq(users.id, userId))
      .run();
  });

  files.forEach(removePhoto);
  return { ok: true };
}

