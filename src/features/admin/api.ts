// Малък помощник за заявките от админския панел: всяка грешка идва като
// { error } от сървъра и се показва на човека, не се поглъща.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

export async function api<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: (data as { error?: string }).error || "Възникна грешка" };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "Няма връзка със сървъра" };
  }
}

export async function uploadPhoto(file: File): Promise<ApiResult<{ id: string; url: string }>> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error || "Качването не успя" };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: "Няма връзка със сървъра" };
  }
}
