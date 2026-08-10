"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<{ amount: string; desc: string; payment_id: string } | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const paymentId = searchParams.get("payment_id");
    const amount = searchParams.get("amount");
    const desc = searchParams.get("desc");

    if (sessionId || paymentId) {
      setData({
        amount: amount || "0",
        desc: desc ? decodeURIComponent(desc) : "",
        payment_id: paymentId || sessionId || "",
      });
    }
  }, [searchParams]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8" style={{ backgroundColor: "#e8f1f2" }}>
      <div className="w-full max-w-md">
        <div className="p-8 rounded-2xl border bg-white text-center shadow-lg" style={{ borderColor: "#dcfce7" }}>
          {/* Success icon */}
          <div
            className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: "#dcfce7" }}
          >
            <svg
              className="w-10 h-10"
              style={{ color: "#16a34a" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#16a34a" }}>
            Плащането е успешно!
          </h1>
          <p className="text-sm mb-6" style={{ color: "#247ba0" }}>
            Благодарим ви! Вашето плащане беше обработено успешно.
          </p>

          {data && (
            <div
              className="p-4 rounded-xl mb-6 text-left space-y-2"
              style={{ background: "#f8fafc", border: "1px solid #e4e9f0" }}
            >
              {data.amount && data.amount !== "0" && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold" style={{ color: "#247ba0" }}>Сума</span>
                  <span className="text-sm font-bold" style={{ color: "#006494" }}>
                    {parseFloat(data.amount).toFixed(2)} лв
                  </span>
                </div>
              )}
              {data.desc && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold" style={{ color: "#247ba0" }}>Описание</span>
                  <span className="text-sm font-bold text-right max-w-[60%]" style={{ color: "#006494" }}>
                    {data.desc}
                  </span>
                </div>
              )}
              {data.payment_id && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold" style={{ color: "#247ba0" }}>ID на плащане</span>
                  <span className="text-xs font-mono" style={{ color: "#64748b" }}>
                    {data.payment_id.slice(0, 12)}...
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold" style={{ color: "#247ba0" }}>Метод</span>
                <span className="text-sm font-bold" style={{ color: "#006494" }}>💳 Карта (Stripe)</span>
              </div>
            </div>
          )}

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}
          >
            Към таблото
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold border mt-3 transition hover:bg-gray-50"
            style={{ borderColor: "#e4e9f0", color: "#247ba0" }}
          >
            ⬅️ Обратно
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: "#e8f1f2" }}>
          <div className="text-lg" style={{ color: "#247ba0" }}>Зареждане...</div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
