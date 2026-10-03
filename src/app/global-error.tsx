"use client";

/** Последна защита: грешка в самия layout. Без Tailwind — може и той да липсва. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="bg">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#e8f1f2", textAlign: "center", padding: "20vh 16px" }}>
        <h1 style={{ fontSize: 20, color: "#0f172a" }}>Нещо се обърка</h1>
        <p style={{ color: "#64748b" }}>Опитайте да презаредите страницата.</p>
        <button
          onClick={reset}
          style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: 0, background: "#1b98e0", color: "#fff", fontSize: 16 }}
        >
          Опитай пак
        </button>
      </body>
    </html>
  );
}
