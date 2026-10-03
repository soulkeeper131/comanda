// Малък помощник за заявките от клиентския екран. API-то връща грешките като
// { error: "съобщение на български" } — показваме ги дословно.

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export async function api<T = unknown>(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error =
        (data && typeof data === "object" && "error" in data && typeof data.error === "string" && data.error) ||
        "Нещо се обърка. Опитайте отново.";
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "Няма връзка. Проверете интернета и опитайте отново." };
  }
}

/** GET, който при грешка връща празна стойност — за секции, които не бива да чупят екрана. */
export async function getOr<T>(url: string, fallback: T): Promise<T> {
  const r = await api<T>(url);
  return r.ok && r.data !== null ? r.data : fallback;
}
