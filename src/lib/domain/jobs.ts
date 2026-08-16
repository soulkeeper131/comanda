export type ItemForCheck = {
  proof_type: string | null;
  label: string;
};

export type MarkOptions = {
  hasEvidence: boolean;
  isAdmin: boolean;
  reason: string | null;
};

export type Verdict = { ok: true } | { ok: false; error: string };

const MIN_REASON_LENGTH = 5;

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

  if (!opts.reason || opts.reason.trim().length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      error: "За отмятане без снимка е задължителна причина (поне 5 знака).",
    };
  }

  return { ok: true };
}
