"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export default function Topbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

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
        <img src="/logo.png" alt="Ко Манда" className="h-8 w-auto" />
      </Link>

      <div className="flex-1" />

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{
            background: "linear-gradient(140deg, #a663cc, #247ba0)",
          }}
        >
          В
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
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition"
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
