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

/** Всички валидни статуси — извеждат се от картата, за да не се разминават. */
export const VALID_DECISIONS = Object.keys(TRANSITIONS) as OfferDecision[];

export function isValidDecision(value: unknown): value is OfferDecision {
  return typeof value === "string" && (VALID_DECISIONS as string[]).includes(value);
}

export function allowedTransitions(from: OfferDecision): OfferDecision[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: OfferDecision, to: OfferDecision): boolean {
  return allowedTransitions(from).includes(to);
}
