"use client";

import { useRouter } from "next/navigation";

export default function CancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8" style={{ backgroundColor: "#e8f1f2" }}>
      <div className="w-full max-w-md">
        <div className="p-8 rounded-2xl border bg-white text-center shadow-lg" style={{ borderColor: "#fee2e2" }}>
          {/* Cancel icon */}
          <div
            className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: "#fee2e2" }}
          >
            <svg
              className="w-10 h-10"
              style={{ color: "#dc2626" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#dc2626" }}>
            Плащането е отказано
          </h1>
          <p className="text-sm mb-6" style={{ color: "#247ba0" }}>
            Плащането не беше завършено. Няма проблем — можеш да опиташ отново, когато си готов.
          </p>

          <div
            className="p-4 rounded-xl mb-6 text-left"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">💡</span>
              <p className="text-xs leading-relaxed" style={{ color: "#991b1b" }}>
                Ако си променил решението си или си срещнал проблем с плащането, можеш да се върнеш и да опиташ отново. При нужда от помощ, свържи се с нас.
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}
          >
            🔄 Опитай отново
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold border mt-3 transition hover:bg-gray-50"
            style={{ borderColor: "#e4e9f0", color: "#247ba0" }}
          >
            ⬅️ Към таблото
          </button>
        </div>
      </div>
    </div>
  );
}
