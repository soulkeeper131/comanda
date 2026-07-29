import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setUser({ name: data.name, role: data.role }))
      .catch(() => {});
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

      {/* User menu */}
      <div className="relative flex items-center gap-2">
        {badge && (
          <span
            className="hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: badge.color + "18", color: badge.color, border: `1px solid ${badge.color}40` }}
          >
            {badge.label}
          </span>
        )}
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
                Меню
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 min-h-[44px] py-3 text-sm hover:bg-gray-50 transition"
                style={{ color: "#006494" }}
              >
                Изход
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
