"use client";

import { useEffect } from "react";

/** Грешка при рендиране на страница — на български и с опция за нов опит. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-bg px-4 text-center">
      <h1 className="text-xl font-bold text-ink">Нещо се обърка</h1>
      <p className="max-w-sm text-sm text-muted">
        Опитайте пак. Ако се повтаря, пишете ни{error.digest ? ` и посочете код ${error.digest}` : ""}.
      </p>
      <div className="flex gap-2">
        <button onClick={reset} className="min-h-touch rounded-card bg-brand-primary px-4 font-semibold text-white">
          Опитай пак
        </button>
        <a href="/" className="flex min-h-touch items-center rounded-card border border-line bg-white px-4 font-semibold text-brand-secondary">
          Начало
        </a>
      </div>
    </main>
  );
}
