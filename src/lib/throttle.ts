/**
 * „Най-много веднъж за период" в паметта на процеса — за автоматичните
 * имейли към адреси, въведени от непознат (запитване, регистрация с чужд
 * имейл). Рестартът го нулира — достатъчно, за да не стане сървърът ни
 * машина за спам към един адрес.
 */
const last = new Map<string, number>();

export function allowOnce(key: string, windowMs: number, now = Date.now()): boolean {
  const prev = last.get(key);
  if (prev !== undefined && now - prev < windowMs) return false;
  last.set(key, now);
  if (last.size > 10_000) {
    last.forEach((t, k) => {
      if (now - t > windowMs) last.delete(k);
    });
  }
  return true;
}
