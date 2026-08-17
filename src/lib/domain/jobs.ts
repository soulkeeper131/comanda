export type ItemForCheck = {
  proof_type: string | null;
  label: string;
};

export type MarkOptions = {
  hasEvidence: boolean;
  isAdmin: boolean;
  reason: string | null;
};

import { isValidOverrideReason, MIN_REASON_LENGTH } from "./overrides";

export type Verdict = { ok: true } | { ok: false; error: string };

/**
 * Може ли стъпката да се отметне като изпълнена?
 *
 * Правилото: стъпка с proof_type "photo" изисква качена снимка, преди да се
 * отметне като изпълнена — продуктът се продава с „виждате доказателство
 * какво е свършено". Админ може да прескочи (счупена камера е реален
 * случай), но само с причина от поне 5 знака — записва се в overrides от
 * извикващия route, СЛЕД като отмятането е сигурно.
 */
export function canMarkItemDone(item: ItemForCheck, opts: MarkOptions): Verdict {
  const needsPhoto = item.proof_type === "photo";

  if (!needsPhoto || opts.hasEvidence) return { ok: true };

  if (!opts.isAdmin) {
    return {
      ok: false,
      error: `Стъпката "${item.label}" изисква снимка, преди да бъде отметната.`,
    };
  }

  // Същото правило, което пази recordOverride — един източник, за да не може
  // проверката тук да одобри причина, която записът после отхвърля с грешка
  // (вече след като done: true е записано).
  if (!isValidOverrideReason(opts.reason)) {
    return {
      ok: false,
      error: `За отмятане без снимка е задължителна причина (поне ${MIN_REASON_LENGTH} знака).`,
    };
  }

  return { ok: true };
}
