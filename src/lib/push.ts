import webpush from "web-push";

export function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env.local");
  }

  return { publicKey, privateKey };
}

let webpushInitialized = false;

export function ensureWebpushConfigured() {
  if (webpushInitialized) return;

  const { publicKey, privateKey } = getVapidKeys();

  webpush.setVapidDetails(
    "mailto:admin@comanda.blv.bg",
    publicKey,
    privateKey
  );

  webpushInitialized = true;
}
