import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";
import AccountSheet from "./AccountSheet";
import { Badge } from "./ui/Badge";
import { Icon } from "./ui/Icon";
import { getQueueLength, initOfflineSync } from "@/lib/offline-sync";

const ROLE_BADGE: Record<string, { label: string; tone: "accent" | "info" | "warning" }> = {
  admin: { label: "Админ", tone: "accent" },
  client: { label: "Клиент", tone: "info" },
  inspector: { label: "Инспектор", tone: "warning" },
};

export default function Topbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);

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
    const unsynced = getQueueLength();
    if (
      unsynced > 0 &&
      !confirm(`${unsynced} действия още не са изпратени. Излезте ли сега, ще се изпратят чак при следващо влизане от това устройство. Да изляза ли?`)
    ) {
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    // Кешът за офлайн четене е на този потребител — триe се, освен ако има
    // неизпратена работа (тя е по-ценна от чистотата на кеша).
    if (unsynced === 0) {
      try {
        indexedDB.deleteDatabase("komanda-offline");
      } catch {
        /* няма IndexedDB */
      }
    }
    // Кешираните страници не бива да останат за следващия на устройството.
    navigator.serviceWorker?.controller?.postMessage("logout");
    router.push("/");
    router.refresh();
  };

  const badge = user ? ROLE_BADGE[user.role] : null;
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "·";

  return (
    <header
      className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 md:py-2 border-b flex-shrink-0 md:h-14"
      style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(14px)",
        borderColor: "#e4e9f0",
        paddingTop: "max(12px, env(safe-area-inset-top))",
      }}
    >
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center no-underline md:hidden">
        <img src="/logo.png" alt="КОМАНДА" className="h-16 w-auto" />
      </Link>
      {/* Desktop: compact brand */}
      <Link href="/dashboard" className="hidden md:flex items-center no-underline">
        <img src="/logo.png" alt="КОМАНДА" className="h-10 w-auto" />
      </Link>

      <div className="flex-1" />

      {/* Офлайн / чакащи за синхронизация действия */}
      {!isOnline && (
        <span className="inline-flex items-center gap-1 rounded-full bg-state-danger/10 px-2 py-1 text-xs font-bold text-state-danger" title="Няма интернет връзка">
          <Icon name="wifi-off" size={14} /> Офлайн
        </span>
      )}
      {pendingCount > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-state-warning/10 px-2 py-1 text-xs font-bold text-state-warning"
          title={`${pendingCount} действия чакат синхронизация`}
        >
          <Icon name="refresh" size={14} /> {pendingCount}
        </span>
      )}

      <div className="relative flex items-center gap-1.5">
        {badge && (
          <Badge tone={badge.tone} className="hidden sm:inline-flex">
            {badge.label}
          </Badge>
        )}
        <NotificationBell />
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-dark text-sm font-bold text-white"
          aria-label="Меню"
        >
          {initial}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-12 z-20 min-w-[220px] overflow-hidden rounded-card border border-line bg-white py-1 shadow-card-3">
              <div className="px-4 py-2.5">
                <div className="text-sm font-bold text-ink">{user?.name || "Профил"}</div>
                {badge && <div className="text-xs text-muted">{badge.label}</div>}
              </div>
              <div className="my-1 border-t border-line" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setAccountOpen(true);
                }}
                className="flex min-h-touch w-full items-center gap-2 px-4 text-left text-sm text-ink hover:bg-brand-bg"
              >
                <Icon name="user" size={18} /> Профил{user?.role === "client" ? " и плащания" : ""}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleSignOut();
                }}
                className="flex min-h-touch w-full items-center gap-2 px-4 text-left text-sm text-ink hover:bg-brand-bg"
              >
                <Icon name="logout" size={18} /> Изход
              </button>
            </div>
          </>
        )}
      </div>
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </header>
  );
}
