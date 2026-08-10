"use client";

import { useState } from "react";

interface PaymentPanelProps {
  offerId?: string;
  price: number;
  title: string;
  // Backward compat aliases
  amount?: number;
  description?: string;
  onPaid?: () => void;
  onClose?: () => void;
}

export default function PaymentPanel({ offerId, price, title, amount, description, onPaid, onClose }: PaymentPanelProps) {
  const displayAmount = price || amount || 0;
  const displayDescription = title || description || "";

  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [status, setStatus] = useState<"idle" | "loading" | "redirecting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleStripePay = async () => {
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offerId,
          amount: displayAmount,
          currency: "bgn",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Грешка при инициализиране на плащане");
        setStatus("error");
        return;
      }

      // Redirect to Stripe Checkout
      setStatus("redirecting");
      window.location.href = data.url;
    } catch {
      setErrorMsg("Възникна грешка. Опитай отново.");
      setStatus("error");
    }
  };

  const handleBankTransfer = async () => {
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: displayAmount,
          description: displayDescription,
          offer_id: offerId,
          payment_method: "transfer",
        }),
      });

      if (res.ok) {
        onPaid?.();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Грешка при запис на плащане");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Възникна грешка. Опитай отново.");
      setStatus("error");
    }
  };

  const handlePay = () => {
    if (method === "card") {
      handleStripePay();
    } else {
      handleBankTransfer();
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div
          className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl border bg-white max-h-[90dvh] overflow-y-auto animate-slide-up"
          style={{ borderColor: "#e4e9f0" }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: "#006494" }}>
                Плащане
              </h3>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition hover:bg-gray-100"
                  style={{ color: "#247ba0", minHeight: "44px", minWidth: "44px" }}
                  aria-label="Затвори"
                >
                  ✕
                </button>
              )}
            </div>

            <p className="text-sm mb-4" style={{ color: "#247ba0" }}>
              {displayDescription}
            </p>

            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-3xl font-extrabold" style={{ color: "#1b98e0" }}>
                {displayAmount.toFixed(2)}
              </span>
              <span className="text-sm font-semibold" style={{ color: "#247ba0" }}>
                лв
              </span>
            </div>

            {/* Метод на плащане */}
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>
                Метод на плащане
              </label>
              <div className="flex gap-3">
                <label
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition text-sm font-semibold ${
                    method === "card"
                      ? "border-[#1b98e0] bg-blue-50 text-[#1b98e0]"
                      : "border-gray-200 text-[#247ba0]"
                  }`}
                  style={{ minHeight: "44px" }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={method === "card"}
                    onChange={() => setMethod("card")}
                    className="sr-only"
                  />
                  💳 Карта
                </label>
                <label
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition text-sm font-semibold ${
                    method === "transfer"
                      ? "border-[#1b98e0] bg-blue-50 text-[#1b98e0]"
                      : "border-gray-200 text-[#247ba0]"
                  }`}
                  style={{ minHeight: "44px" }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="transfer"
                    checked={method === "transfer"}
                    onChange={() => setMethod("transfer")}
                    className="sr-only"
                  />
                  🏦 Банков превод
                </label>
              </div>
              {method === "transfer" && (
                <p className="mt-2 text-xs p-2 rounded-lg" style={{ color: "#d97706", background: "#fef3c7" }}>
                  ⚠️ Банковият превод се обработва ръчно. След натискане на бутона, ние ще се свържем с вас за
                  детайли по плащането.
                </p>
              )}
            </div>

            {/* Error state */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
                {errorMsg}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              {onClose && (
                <button
                  onClick={onClose}
                  disabled={status === "loading" || status === "redirecting"}
                  className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold border disabled:opacity-60"
                  style={{ borderColor: "#e4e9f0", color: "#247ba0" }}
                >
                  Отказ
                </button>
              )}
              <button
                onClick={handlePay}
                disabled={status === "loading" || status === "redirecting"}
                className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}
              >
                {status === "loading" && (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Обработка...
                  </>
                )}
                {status === "redirecting" && "⏳ Пренасочване към Stripe..."}
                {status === "idle" && (method === "card" ? "💳 Плати с карта" : "🏦 Плати с превод")}
                {status === "error" && "🔄 Опитай отново"}
              </button>
            </div>

            {/* Stripe badge */}
            {method === "card" && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: "#94a3b8" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#635BFF" />
                </svg>
                Плащането се обработва през Stripe
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
