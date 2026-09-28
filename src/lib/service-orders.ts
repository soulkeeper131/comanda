import { db } from "@/db";
import { serviceOrders, payments, properties, serviceTemplates, jobs, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureInvoice } from "@/lib/payments";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { emailLayout, formatEur } from "@/lib/mail-layout";
import { todaySofia } from "@/lib/jobs-generator";
import { addDays } from "@/lib/domain/plans";

/**
 * Еднократна допълнителна услуга (уточнение 6б). Плаща се предварително;
 * при плащане става обход на избраната дата при инспектора на имота.
 * Идемпотентно — второ извикване за вече платена заявка не прави нищо.
 */
export async function settleServiceOrder(opts: {
  orderId: string;
  paymentId?: string;
  method: "card" | "bank";
  stripe?: { session_id?: string | null; payment_intent_id?: string | null };
}): Promise<{ ok: boolean; jobId?: string; invoiceNumber?: string | null }> {
  const order = db.select().from(serviceOrders).where(eq(serviceOrders.id, opts.orderId)).get();
  if (!order) return { ok: false };
  if (order.status === "paid") {
    // Повторен webhook — фактурата се довършва, ако първия път не е станала.
    const paid = opts.paymentId ? db.select().from(payments).where(eq(payments.id, opts.paymentId)).get() : undefined;
    if (paid && paid.status !== "paid") markForRefund(paid.id, opts, "Двойно плащане за допълнителна услуга");
    else if (paid) ensureInvoice(paid.id);
    return { ok: true, jobId: order.job_id ?? undefined };
  }

  const property = db.select().from(properties).where(eq(properties.id, order.property_id)).get();
  if (order.status === "cancelled") {
    // Оттеглена заявка, платена после от стар таб — парите са взети без
    // услуга: за връщане, и екипът знае.
    if (opts.paymentId) markForRefund(opts.paymentId, opts, `Платена оттеглена услуга — ${property?.name ?? ""}`);
    return { ok: false };
  }

  const template = db.select().from(serviceTemplates).where(eq(serviceTemplates.id, order.template_id)).get();
  if (!property || !template) return { ok: false };
  const inspector = property.assigned_inspector_id
    ? db.select().from(users).where(eq(users.id, property.assigned_inspector_id)).get()
    : undefined;
  const assignee = inspector && inspector.active !== false ? inspector.id : null;
  const now = new Date().toISOString();
  // Превод, потвърден след заявената дата — обходът е утре, не в миналото.
  const tomorrow = addDays(todaySofia(), 1);
  const plannedAt = order.requested_date < tomorrow ? tomorrow : order.requested_date;

  const { jobId, paymentId } = db.transaction((tx) => {
    let pid = opts.paymentId;
    if (!pid) {
      const pending = tx
        .select()
        .from(payments)
        .where(and(eq(payments.order_id, order.id), eq(payments.status, "pending")))
        .get();
      pid = pending?.id;
    }
    if (!pid) {
      const [created] = tx
        .insert(payments)
        .values({ user_id: property.owner_id, order_id: order.id, amount: order.price, method: opts.method, status: "pending" })
        .returning()
        .all();
      pid = created.id;
    }
    tx.update(payments)
      .set({
        status: "paid",
        paid_at: now,
        method: opts.method,
        stripe_session_id: opts.stripe?.session_id ?? undefined,
        stripe_payment_intent_id: opts.stripe?.payment_intent_id ?? undefined,
      })
      .where(eq(payments.id, pid))
      .run();
    const [job] = tx
      .insert(jobs)
      .values({
        org_id: property.org_id,
        property_id: property.id,
        template_id: template.id,
        assignee_id: assignee,
        title: `${template.name} — ${property.name}`,
        duration_min: template.duration_min,
        planned_at: plannedAt,
        status: "planned",
        note: order.note ? `Заявка на клиента: ${order.note}` : null,
      })
      .returning()
      .all();
    tx.update(serviceOrders).set({ status: "paid", job_id: job.id }).where(eq(serviceOrders.id, order.id)).run();
    return { jobId: job.id, paymentId: pid };
  });

  const invoice = ensureInvoice(paymentId, `Допълнителна услуга: ${template.name} — ${property.name}`);
  const day = new Date(plannedAt + "T12:00:00").toLocaleDateString("bg-BG");
  createNotification(property.owner_id, "plan_scheduled", "Услугата е насрочена", `${template.name} — ${day}`, "/dashboard");
  if (assignee) createNotification(assignee, "job_started", "Нова допълнителна услуга", `${template.name} — ${property.name}, ${day}`, "/dashboard");
  else notifyAdmins("plan_requested", "Допълнителна услуга без инспектор", `${property.name} — ${template.name}, ${day}`, "/dashboard");

  const html = emailLayout({
    title: "Платена допълнителна услуга",
    rows: [
      ["Имот", property.name],
      ["Услуга", template.name],
      ["Дата", day],
      ["Бележка", order.note],
      ["Сума", formatEur(order.price)],
      ["Фактура", invoice?.number],
    ],
    cta: { label: "Отвори" },
  });
  const notify = await getNotifyEmail();
  if (notify) sendEmail({ to: notify, subject: `Допълнителна услуга: ${template.name} — ${property.name}`, html }).catch(() => {});
  return { ok: true, jobId, invoiceNumber: invoice?.number ?? null };
}

function markForRefund(
  paymentId: string,
  opts: { stripe?: { session_id?: string | null; payment_intent_id?: string | null } },
  title: string,
) {
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment || payment.status === "refund_needed" || payment.status === "refunded") return;
  db.update(payments)
    .set({
      status: "refund_needed",
      stripe_session_id: opts.stripe?.session_id ?? undefined,
      stripe_payment_intent_id: opts.stripe?.payment_intent_id ?? undefined,
    })
    .where(eq(payments.id, paymentId))
    .run();
  notifyAdmins("offer_decided", "Нужно е връщане на сума", `${title}: ${formatEur(payment.amount)}`, "/dashboard");
}
