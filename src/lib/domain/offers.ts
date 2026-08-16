export type OfferDecision =
  | "pending" | "accepted" | "declined" | "paid" | "in_progress" | "done";

/**
 * Разрешените преходи. Всичко извън тази карта се отказва.
 *
 * pending ──→ accepted ──→ paid ──→ in_progress ──→ done
 *    └─────→ declined
 */
const TRANSITIONS: Record<OfferDecision, OfferDecision[]> = {
  pending: ["accepted", "declined"],
  accepted: ["paid"],
  declined: [],
  paid: ["in_progress"],
  in_progress: ["done"],
  done: [],
};

export function allowedTransitions(from: OfferDecision): OfferDecision[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: OfferDecision, to: OfferDecision): boolean {
  return allowedTransitions(from).includes(to);
}
