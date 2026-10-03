import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobs, payments, plans, properties } from "@/db/schema";
import { removePlannedJobsAfter, todaySofia } from "@/lib/jobs-generator";
import { endOfPaidPeriod } from "@/lib/domain/plans";
import { cancelStripeSubscription, expirePlanCheckout } from "@/lib/subscriptions";
import { notify, propertyLink } from "@/lib/messages";
import { formatEur } from "@/lib/mail-layout";
import { formatDateOnly } from "@/lib/format";

export type CancelResult =
  | { ok: true; endsAt: string | null; refund: number; removed: number }
  | { ok: false; error: string; status: number };

/**
 * Отказ от абонамент (въпрос 5 и §3 от условията) — едно място за клиента,
 * админа и изтриването на профил.
 *
 * - Още няма завършен обход → спира веднага, всички обходи се махат и
 *   платеното отива за връщане (условията го обещават).
 * - Вече е обслужван → важи до края на платения период (Stripe или
 *   платеното по банка), после спира.
 */
export async function cancelPlan(planId: string, opts: { byAdmin: boolean; endsAt?: string }): Promise<CancelResult> {
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!plan || !property) return { ok: false, error: "Абонаментът не е намерен", status: 404 };
  if (plan.status === "cancelled") return { ok: false, error: "Абонаментът вече е отказан", status: 409 };

  const today = todaySofia();
  const served = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.plan_id, plan.id), eq(jobs.status, "completed")))
    .get();
  const neverStarted = !served;

  let endsAt: string | null;
  try {
    endsAt = await cancelStripeSubscription(plan.id, neverStarted);
  } catch (err) {
    console.error("[plans] Stripe cancel failed:", err);
    return { ok: false, error: "Stripe не прие отказа — опитайте пак след малко", status: 502 };
  }
  await expirePlanCheckout(plan.id);
  if (!endsAt) endsAt = plan.paid_until ? (plan.paid_until >= today ? plan.paid_until : today) : endOfPaidPeriod(today);
  if (opts.byAdmin && opts.endsAt && /^\d{4}-\d{2}-\d{2}$/.test(opts.endsAt) && !plan.stripe_subscription_id) {
    endsAt = opts.endsAt < today ? today : opts.endsAt;
  }

  const { removed, refund } = db.transaction((tx) => {
    tx.update(plans)
      .set({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        stripe_checkout_session_id: null,
        // Никога не тръгнал абонамент не „важи до" никоя дата — имотът
        // може веднага да заяви нов.
        ends_at: neverStarted ? null : endsAt,
      })
      .where(eq(plans.id, plan.id))
      .run();
    tx.update(payments)
      .set({ status: "cancelled" })
      .where(and(eq(payments.plan_id, plan.id), eq(payments.status, "pending")))
      .run();
    let refund = 0;
    if (neverStarted) {
      const paid = tx
        .select()
        .from(payments)
        .where(and(eq(payments.plan_id, plan.id), inArray(payments.status, ["paid"])))
        .all();
      for (const p of paid) {
        tx.update(payments).set({ status: "refund_needed" }).where(eq(payments.id, p.id)).run();
        refund += p.amount;
      }
    }
    return { removed: removePlannedJobsAfter(plan.id, neverStarted ? "0000-00-00" : endsAt!, tx), refund };
  });

  // Стари абонаменти с карта, платени преди плащанията да се връзват с плана.
  const legacyCardRefund = neverStarted && plan.stripe_subscription_id && refund === 0;
  const refundText = refund > 0 ? formatEur(refund) : legacyCardRefund ? "първото плащане в Stripe" : null;
  const clientOutcome = neverStarted
    ? refundText
      ? `абонаментът е спрян. Още не сме идвали, затова ще ви върнем ${refundText}.`
      : "заявката е оттеглена."
    : `обслужването продължава до ${formatDateOnly(endsAt)}; обходите след това са махнати от графика.`;
  const teamOutcome = neverStarted
    ? refundText
      ? `отказан преди първия обход — върнете ${refundText} от Табло → Суми за връщане`
      : "заявката е оттеглена"
    : `важи до ${formatDateOnly(endsAt)}`;
  // Клиентът винаги получава потвърждение — и когато отказва сам.
  await notify("plan_cancelled", { to: property.owner_id, vars: { property: property.name, outcome: clientOutcome }, link: propertyLink(property.id) });
  if (!opts.byAdmin || refundText) {
    await notify("plan_cancelled_team", { to: "admins", vars: { property: property.name, outcome: teamOutcome } });
  }
  if (removed > 0 && property.assigned_inspector_id) {
    await notify("visits_removed", {
      to: property.assigned_inspector_id,
      vars: { count: `${removed} ${removed === 1 ? "обход" : "обхода"}`, property: property.name, reason: "абонаментът е прекратен" },
    });
  }
  return { ok: true, endsAt: neverStarted ? null : endsAt, refund, removed };
}
