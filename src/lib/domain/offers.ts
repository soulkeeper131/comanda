export type OfferDecision =
  | "pending" | "accepted" | "declined" | "paid" | "in_progress" | "done" | "expired";

/** Колко дни е валидна офертата (въпрос 21). */
export const OFFER_VALID_DAYS = 7;

/**
 * Праг за предплащане (въпрос 22б — предложени 200 лв ≈ 100 €). Под прага
 * работата тръгва веднага и се плаща след нея; над прага — предварително.
 * Може да се смени от `settings` (ключ `prepay_threshold`).
 */
export const DEFAULT_PREPAY_THRESHOLD = 100;

/**
 * Предплащане (голяма сума):
 *   pending ──→ accepted ──→ paid ──→ in_progress ──→ done
 *
 * Плащане след работата (малка сума):
 *   pending ──→ accepted ──→ in_progress ──→ done ──→ paid
 *
 * И при двата: pending ──→ declined | expired (крайни).
 */
const PREPAY: Record<OfferDecision, OfferDecision[]> = {
  pending: ["accepted", "declined", "expired"],
  accepted: ["paid"],
  declined: [],
  expired: [],
  paid: ["in_progress"],
  in_progress: ["done"],
  done: [],
};

const PAY_AFTER: Record<OfferDecision, OfferDecision[]> = {
  pending: ["accepted", "declined", "expired"],
  accepted: ["in_progress"],
  declined: [],
  expired: [],
  in_progress: ["done"],
  done: ["paid"],
  paid: [],
};

/** Всички валидни статуси — извеждат се от картата, за да не се разминават. */
export const VALID_DECISIONS = Object.keys(PREPAY) as OfferDecision[];

export function isValidDecision(value: unknown): value is OfferDecision {
  return typeof value === "string" && (VALID_DECISIONS as string[]).includes(value);
}

/**
 * Предплаща ли се офертата. Без цена (null) — предплащане, по-безопасното
 * поведение, което важеше и преди двата потока.
 */
export function requiresPrepayment(
  price: number | null | undefined,
  threshold: number = DEFAULT_PREPAY_THRESHOLD,
): boolean {
  if (price === null || price === undefined) return true;
  return price >= threshold;
}

/**
 * Предплаща ли се тази оферта. Решението се пази в офертата при създаването
 * (`requires_prepayment`); смяната на прага по-късно не пипа вече тръгнали
 * оферти. За стари записи без флаг — изчислява се от цената.
 */
export function offerPrepay(
  offer: { requires_prepayment?: boolean | null; price: number | null },
  threshold?: number,
): boolean {
  if (offer.requires_prepayment === true || offer.requires_prepayment === false) return offer.requires_prepayment;
  return requiresPrepayment(offer.price, threshold);
}

export function allowedTransitions(from: OfferDecision, prepay: boolean = true): OfferDecision[] {
  const map = prepay ? PREPAY : PAY_AFTER;
  return map[from] ?? [];
}

export function canTransition(from: OfferDecision, to: OfferDecision, prepay: boolean = true): boolean {
  return allowedTransitions(from, prepay).includes(to);
}

/** Чака ли офертата плащане от клиента в момента. */
export function awaitsPayment(decision: OfferDecision, prepay: boolean): boolean {
  return canTransition(decision, "paid", prepay);
}

/** Изтекла ли е офертата към момента `now`. */
export function isExpired(
  offer: { decision: string | null; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (offer.decision !== "pending" || !offer.expires_at) return false;
  return new Date(offer.expires_at).getTime() <= now.getTime();
}

export function expiryFrom(sentAt: Date = new Date()): string {
  return new Date(sentAt.getTime() + OFFER_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Кое напомняне за отговор е дължимо (ден 3 и ден 6 — въпрос 21).
 * Връща номера на напомнянето (1 или 2) или null.
 */
export function dueOfferReminder(
  sentAt: string,
  remindersSent: number,
  now: Date = new Date(),
): 1 | 2 | null {
  const days = (now.getTime() - new Date(sentAt).getTime()) / (24 * 60 * 60 * 1000);
  if (remindersSent < 1 && days >= 3 && days < 6) return 1;
  if (remindersSent < 2 && days >= 6) return 2;
  return null;
}

/**
 * Напомняне за неплатена завършена работа — ден 3, 7 и 14 (въпрос 22б).
 */
export function duePaymentReminder(
  doneAt: string,
  remindersSent: number,
  now: Date = new Date(),
): number | null {
  const days = (now.getTime() - new Date(doneAt).getTime()) / (24 * 60 * 60 * 1000);
  const schedule = [3, 7, 14];
  // Само следващото поред — ако скриптът не е вървял няколко дни, не
  // пращаме три имейла наведнъж.
  const next = schedule[remindersSent];
  if (next === undefined) return null;
  return days >= next ? remindersSent + 1 : null;
}
