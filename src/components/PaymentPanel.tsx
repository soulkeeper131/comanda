"use client";

import { useState } from "react";

interface PaymentPanelProps {
  amount: number;
  description: string;
  offerId?: string;
  onPaid?: () => void;
  onClose?: () => void;
}

export default function PaymentPanel({ amount, description, offerId, onPaid, onClose }: PaymentPanelProps) {
  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [status, setStatus] = useState<"idle" | "loading" | "paid" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handlePay = async () => {
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description,
          offer_id: offerId,
          payment_method: method,
        }),
      });

      if (res.ok) {
        setStatus("paid");
        onPaid?.();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Грешка при плащане");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Възникна грешка. Опитай отново.");
      setStatus("error");
    }
  };

  if (status === "paid") {
    return (
      <div className="p-6 rounded-2xl border bg-white text-center" style={{ borderColor: "#dcfce7" }}>
        <div className="text-5xl mb-3">✅</div>
        <h3 className="text-lg font-bold mb-2" style={{ color: "#16a34a" }}>Платено!</h3>
        <p className="text-sm" style={{ color: "#247ba0" }}>
          Плащането от {amount.toFixed(2)} лв е успешно обработено.
        </p>
        <button
          onClick={onClose}
          className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold border"
          style={{ borderColor: "#e4e9f0", color: "#247ba0", minHeight: "44px" }}
        >
          Затвори
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl border bg-white" style={{ borderColor: "#e4e9f0" }}>
      <h3 className="text-lg font-bold mb-1" style={{ color: "#006494" }}>Плащане</h3>
      <p className="text-sm mb-4" style={{ color: "#247ba0" }}>{description}</p>

      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-3xl font-extrabold" style={{ color: "#1b98e0" }}>{amount.toFixed(2)}</span>
        <span className="text-sm font-semibold" style={{ color: "#247ba0" }}>лв</span>
      </div>

      {/* Метод на плащане */}
      <div className="mb-5">
        <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Метод на плащане</label>
        <div className="flex gap-3">
          <label
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition text-sm font-semibold ${
              method === "card" ? "border-[#1b98e0] bg-blue-50 text-[#1b98e0]" : "border-gray-200 text-[#247ba0]"
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
              method === "transfer" ? "border-[#1b98e0] bg-blue-50 text-[#1b98e0]" : "border-gray-200 text-[#247ba0]"
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
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <div className="flex gap-3">
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "#e4e9f0", color: "#247ba0" }}
          >
            Отказ
          </button>
        )}
        <button
          onClick={handlePay}
          disabled={status === "loading"}
          className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
          style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}
        >
          {status === "loading" ? "⏳ Обработка..." : "💳 Плати"}
        </button>
      </div>
    </div>
  );
}
