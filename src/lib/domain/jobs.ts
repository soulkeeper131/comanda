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

export type JobStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type CancelActor = {
  isAdmin: boolean;
  /** ID на текущия потребител — за проверка дали е самият изпълнител. */
  userId: string;
};

export type JobForCancel = {
  status: JobStatus;
  assignee_id: string | null;
};

/**
 * Може ли задачата да бъде отказана?
 *
 * Админ отказва от всякакъв статус преди "completed". Инспекторът, на когото
 * е възложена задачата, също може да я откаже, но само докато е "planned"
 * или "in_progress" — той е този, който може да стартира по грешка и трябва
 * да има изход, без да чака админ. Причината (проверена от normalizeOverrideReason
 * извън тази функция) остава завинаги в бележката на задачата, така че отказът
 * никога не е тих — вижда се кой, кога и защо е отказал обход.
 *
 * "completed" не се отказва никога — обходът вече е факт.
 * "cancelled" не се отказва повторно — идемпотентност.
 */
export function canCancelJob(job: JobForCancel, actor: CancelActor): Verdict {
  if (job.status === "completed") {
    return { ok: false, error: "Завършена задача не може да бъде отменена." };
  }
  if (job.status === "cancelled") {
    return { ok: false, error: "Задачата вече е отменена." };
  }

  if (actor.isAdmin) return { ok: true };

  if (job.assignee_id === actor.userId) return { ok: true };

  return {
    ok: false,
    error: "Само админ или възложеният инспектор може да отмени задачата.",
  };
}
