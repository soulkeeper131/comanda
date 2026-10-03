import Link from "next/link";
import type { ReactNode } from "react";

/** Обща рамка за публичните страници около входа. */
export default function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-bg p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="КОМАНДА" className="mx-auto h-14" />
        </Link>
        <div className="rounded-lg border border-line bg-white p-6 shadow-card-2">
          <h1 className="mb-4 text-xl font-bold text-ink">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInput =
  "w-full min-h-touch rounded-card border border-line bg-white px-3 text-field text-ink focus:border-brand-primary focus:outline-none";
