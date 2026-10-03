import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-bg px-4 text-center">
      <h1 className="text-xl font-bold text-ink">Страницата не е намерена</h1>
      <p className="max-w-sm text-sm text-muted">Връзката е грешна или страницата вече не съществува.</p>
      <Link href="/" className="flex min-h-touch items-center rounded-card bg-brand-primary px-4 font-semibold text-white">
        Към началото
      </Link>
    </main>
  );
}
