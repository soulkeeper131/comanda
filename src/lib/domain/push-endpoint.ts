/**
 * Push известията се пращат от сървъра към адреса, който браузърът е дал при
 * абонамента. Без проверка всеки влязъл може да запише произволен адрес и
 * сървърът ни да праща заявки навсякъде (вкл. към вътрешни услуги). Затова —
 * само HTTPS към push услугите на браузърите.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge, Opera, Samsung
  "android.googleapis.com",
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari (macOS, iOS 16.4+)
];
const PUSH_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_SUFFIXES.some((s) => host.endsWith(s));
}

const B64URL = /^[A-Za-z0-9_-]+=*$/;

/** Ключовете на абонамента — base64url с разумна дължина. */
export function isValidPushKeys(keys: unknown): keys is { p256dh: string; auth: string } {
  if (!keys || typeof keys !== "object") return false;
  const k = keys as Record<string, unknown>;
  return (
    typeof k.p256dh === "string" &&
    typeof k.auth === "string" &&
    k.p256dh.length <= 200 &&
    k.auth.length <= 100 &&
    B64URL.test(k.p256dh) &&
    B64URL.test(k.auth)
  );
}
