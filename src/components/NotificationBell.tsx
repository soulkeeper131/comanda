"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  job_started: "📋",
  job_done: "✅",
  finding_new: "⚠️",
  offer_new: "💰",
  offer_decided: "✅",
};

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkRead = async (id: string, link?: string | null) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }

    // Navigate if link provided
    if (link) {
      setOpen(false);
      router.push(link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "току-що";
      if (diffMin < 60) return `преди ${diffMin} мин`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `преди ${diffH} ч`;
      return d.toLocaleDateString("bg-BG");
    } catch {
      return "";
    }
  };

  return (
    <div className="relative flex items-center">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        className="relative w-11 h-11 flex items-center justify-center rounded-full transition"
        style={{
          cursor: "pointer",
          background: "transparent",
          border: "none",
        }}
        title="Нотификации"
      >
        <span className="text-xl" style={{ lineHeight: 1 }}>
          {unreadCount > 0 ? "🔔" : "🔕"}
        </span>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center"
            style={{ background: "#dc2626" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-12 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          style={{ width: "340px", maxWidth: "calc(100vw - 20px)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "#e4e9f0" }}
          >
            <span
              className="text-sm font-bold"
              style={{ color: "#006494" }}
            >
              Нотификации
              {unreadCount > 0 && (
                <span
                  className="ml-2 text-xs px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: "#dc2626" }}
                >
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold transition hover:underline"
                style={{ color: "#1b98e0" }}
              >
                Прочети всички
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: "#247ba0" }}>
                Зареждане...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-3xl mb-2">🔕</div>
                <div className="text-sm" style={{ color: "#247ba0" }}>
                  Няма нови нотификации
                </div>
              </div>
            ) : (
              notifications.map((n) => {
                const icon = TYPE_ICONS[n.type] || "📌";
                return (
                  <button
                    key={n.id}
                    onClick={() => handleMarkRead(n.id, n.link)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      opacity: n.read ? 0.6 : 1,
                    }}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-sm font-semibold leading-snug"
                        style={{ color: "#006494" }}
                      >
                        {n.title}
                      </div>
                      {n.body && (
                        <div
                          className="text-xs mt-0.5 leading-snug"
                          style={{ color: "#247ba0" }}
                        >
                          {n.body}
                        </div>
                      )}
                      <div
                        className="text-xs mt-1"
                        style={{ color: "#94a3b8" }}
                      >
                        {formatTime(n.created_at)}
                      </div>
                    </div>
                    {!n.read && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: "#1b98e0" }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              className="px-4 py-2.5 border-t text-center"
              style={{ borderColor: "#e4e9f0" }}
            >
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/dashboard/notifications");
                }}
                className="text-xs font-semibold transition hover:underline"
                style={{ color: "#1b98e0" }}
              >
                Виж всички →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
