"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type BellState = "loading" | "unsupported" | "unsubscribed" | "subscribed" | "blocked";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export default function PushBell() {
  const [bellState, setBellState] = useState<BellState>("loading");
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Check support + current state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setBellState("unsupported");
      return;
    }

    const permission = Notification.permission;

    if (permission === "denied") {
      setBellState("blocked");
      return;
    }

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          setBellState("subscribed");
        } else if (permission === "granted") {
          // Granted but not subscribed (unusual, but treat as unsubscribed)
          setBellState("unsubscribed");
        } else {
          setBellState("unsubscribed");
        }
      })
      .catch(() => {
        // Случаят "denied" вече е обработен с ранен return по-горе, затова
        // тук остава само "default" | "granted".
        setBellState("unsubscribed");
      });
  }, []);

  const subscribe = useCallback(async () => {
    setBusy(true);
    try {
      // 1. Request permission
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        setBellState("blocked");
        showToast("Известията са блокирани 😕", "error");
        return;
      }

      // 2. Get VAPID public key
      const vapidRes = await fetch("/api/push/vapid-public-key");
      if (!vapidRes.ok) throw new Error("VAPID key fetch failed");
      const { publicKey } = await vapidRes.json();

      // 3. Get service worker registration and subscribe
      const reg = await navigator.serviceWorker.ready;
      // `.buffer` е ArrayBufferLike; PushManager иска точно ArrayBuffer.
      const keyBytes = urlBase64ToUint8Array(publicKey);
      const applicationServerKey = keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength,
      ) as ArrayBuffer;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 4. Send subscription to server
      const subRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!subRes.ok) throw new Error("Subscribe API failed");

      setBellState("subscribed");
      showToast("🔔 Известията са включени!", "success");
    } catch (err) {
      console.error("Push subscribe error:", err);
      showToast("Грешка при включване на известия", "error");
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      setBellState("unsubscribed");
      showToast("🔕 Известията са изключени", "success");
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      showToast("Грешка при изключване на известия", "error");
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const handleClick = useCallback(() => {
    if (busy) return;
    if (bellState === "unsubscribed") {
      subscribe();
    } else if (bellState === "subscribed") {
      unsubscribe();
    }
    // "blocked" and "unsupported" do nothing on click
  }, [busy, bellState, subscribe, unsubscribe]);

  // Loading skeleton
  if (bellState === "loading") {
    return (
      <div className="w-11 h-11 flex items-center justify-center">
        <span className="text-lg opacity-30">🔔</span>
      </div>
    );
  }

  // Nothing rendered for unsupported
  if (bellState === "unsupported") {
    return null;
  }

  const isClickable = bellState === "unsubscribed" || bellState === "subscribed";

  return (
    <>
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 pointer-events-auto"
              style={{
                background: t.type === "success" ? "#e8f5e9" : "#ffebee",
                color: t.type === "success" ? "#2e7d32" : "#c62828",
                border: `1px solid ${t.type === "success" ? "#a5d6a7" : "#ef9a9a"}`,
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Bell button */}
      <button
        onClick={handleClick}
        disabled={!isClickable || busy}
        title={
          bellState === "subscribed"
            ? "Изключи известията"
            : bellState === "unsubscribed"
            ? "Включи известията"
            : bellState === "blocked"
            ? "Известията са блокирани"
            : ""
        }
        className="relative w-11 h-11 flex items-center justify-center rounded-full transition"
        style={{
          cursor: isClickable && !busy ? "pointer" : "not-allowed",
          opacity: busy ? 0.5 : isClickable ? 1 : 0.4,
          background: "transparent",
          border: "none",
        }}
      >
        {/* Bell icon */}
        <span className="text-xl" style={{ lineHeight: 1 }}>
          {bellState === "blocked" ? "🚫" : "🔔"}
        </span>

        {/* Green dot for subscribed */}
        {bellState === "subscribed" && (
          <span
            className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
            style={{ background: "#4caf50" }}
          />
        )}

        {/* Busy spinner overlay */}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              className="w-4 h-4 border-2 rounded-full animate-spin"
              style={{
                borderColor: "#1b98e0 transparent #1b98e0 transparent",
              }}
            />
          </span>
        )}
      </button>
    </>
  );
}

// Helper: convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
