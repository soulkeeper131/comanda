"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      });

      if (result?.error) {
        setError("Грешен имейл или парола");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Възникна грешка. Опитай отново.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ backgroundColor: "#e8f1f2" }}>
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white text-xl font-bold mb-4"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
              boxShadow: "0 4px 16px rgba(0,100,148,0.25)",
            }}
          >
            ◉
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#006494" }}>
            КОМАНДА
          </h1>
          <p className="text-sm mt-2" style={{ color: "#247ba0" }}>
            Влез в профила си
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100"
        >
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>
              Имейл
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivan@example.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px", focusRingColor: "#1b98e0" }}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>
              Парола
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all disabled:opacity-60"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
              boxShadow: "0 4px 14px rgba(0,100,148,0.25)",
            }}
          >
            {loading ? "Вход..." : "Вход"}
          </button>

          <p className="text-center text-sm mt-6" style={{ color: "#247ba0" }}>
            ← Обратно към{" "}
            <a href="/" className="font-semibold hover:underline" style={{ color: "#1b98e0" }}>
              началната страница
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
