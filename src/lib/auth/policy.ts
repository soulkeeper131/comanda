import type { SessionData } from "./session";

/**
 * Правата на едно място, като функции без странични ефекти.
 * Всяка отговаря на въпроса „има ли право?", без да знае за HTTP.
 */

export function isAdmin(session: SessionData): boolean {
  return session.role === "admin";
}

/** Имот се вижда от собственика, от админ и от инспектор (обхожда го). */
export function canViewProperty(
  session: SessionData,
  property: { owner_id: string },
): boolean {
  if (session.role === "admin" || session.role === "inspector") return true;
  return session.role === "client" && property.owner_id === session.uid;
}

/**
 * Оферта се приема/отказва само от собственика на имота — той плаща.
 * Админът нарочно НЕ може да реши вместо него.
 */
export function canDecideOffer(
  session: SessionData,
  property: { owner_id: string },
): boolean {
  return session.role === "client" && property.owner_id === session.uid;
}

/** Стъпка се отмята от назначения инспектор или от админ. */
export function canCompleteJobItem(
  session: SessionData,
  job: { assignee_id: string | null },
): boolean {
  if (session.role === "admin") return true;
  if (session.role !== "inspector") return false;
  return job.assignee_id === session.uid;
}

/** Само админ прескача проверки (снимка, геофенсинг) — и то с причина. */
export function canOverride(session: SessionData): boolean {
  return session.role === "admin";
}
