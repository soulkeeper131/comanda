import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PushBell from "./PushBell";
import NotificationBell from "./NotificationBell";
import { getQueueLength, initOfflineSync } from "@/lib/offline-sync";

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: "Админ", color: "#a663cc" },
  owner: { label: "Собственик", color: "#1b98e0" },
  worker: { label: "Работник", color: "#247ba0" },
  inspector: { label: "Инспектор", color: "#d97706" },
};

export default function Topbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setUser({ name: data.name, role: data.role }))
      .catch(() => {});

    // Init offline sync
    initOfflineSync();

    // Online/offline detection
    const handleOnline = () => {
      setIsOnline(true);
      // Check pending after short delay (allow sync to complete)
      setTimeout(() => setPendingCount(getQueueLength()), 2000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setPendingCount(getQueueLength());
    };

    setIsOnline(navigator.onLine);
    setPendingCount(getQueueLength());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for sync completion
    const handleSyncComplete = () => {
      setPendingCount(getQueueLength());
    };
    window.addEventListener("offline-sync-complete", handleSyncComplete);

    // Poll pending count every 10s
    const interval = setInterval(() => setPendingCount(getQueueLength()), 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-sync-complete", handleSyncComplete);
      clearInterval(interval);
    };
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const badge = user ? ROLE_BADGE[user.role] : null;
  const initial = user ? user.name.charAt(0) : "В";

  return (
    <header
      className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
      style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(14px)",
        borderColor: "#e4e9f0",
        paddingTop: "max(12px, env(safe-area-inset-top))",
      }}
    >
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center no-underline">
        <img src="/logo.png" alt="КОМАНДА" className="h-16 w-auto" />
      </Link>

      <div className="flex-1" />

      {/* Offline indicator + pending sync */}
      <div className="flex items-center gap-1.5">
        {!isOnline && (
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={{ background: "#fee2e2", color: "#dc2626" }}
            title="Няма интернет връзка"
          >
            🚫 Офлайн
          </span>
        )}
        {isOnline && pendingCount > 0 && (
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={{ background: "#fef3c7", color: "#d97706" }}
            title={`${pendingCount} чакащи действия за синхронизация`}
          >
            📶 {pendingCount}
          </span>
        )}
        {isOnline && pendingCount === 0 && (
          <span
            className="text-xs px-1"
            style={{ color: "#16a34a" }}
            title="Онлайн"
          >
            📶
          </span>
        )}
      </div>

      {/* User menu */}
      <div className="relative flex items-center gap-2">
        {badge && (
          <span
            className="inline-block px-2 py-0.5 rounded-full text-xs font-bold mr-1"
            style={{ background: badge.color + "18", color: badge.color, border: `1px solid ${badge.color}40` }}
          >
            {badge.label}
          </span>
        )}
        <NotificationBell />
        <PushBell />
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{
            background: badge
              ? `linear-gradient(140deg, ${badge.color}, #006494)`
              : "linear-gradient(140deg, #a663cc, #247ba0)",
          }}
        >
          {initial}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-11 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[200px] py-1"
            >
              <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ color: "#247ba0" }}>
                {user?.name || "Меню"}
              </div>
              {badge && (
                <div className="px-4 py-1 text-xs" style={{ color: badge.color }}>
                  {badge.label}
                </div>
              )}
              <div className="border-t my-1" style={{ borderColor: "#e4e9f0" }} />
              <button
                onClick={() => { setMenuOpen(false); handleSignOut(); }}
                className="w-full text-left px-4 min-h-[44px] py-3 text-sm hover:bg-gray-50 transition"
                style={{ color: "#006494" }}
              >
                🚪 Изход
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
