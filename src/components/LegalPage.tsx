import Link from "next/link";
import type { ReactNode } from "react";
import { companyInfo, LEGAL_UPDATED } from "@/lib/legal";

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const c = companyInfo();
  return (
    <div className="min-h-[100dvh] bg-brand-bg px-4 py-8">
      <article className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-6 text-ink shadow-card-1 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3">
        <Link href="/" className="text-sm font-semibold text-brand-primary">
          Ко Манда
        </Link>
        <h1 className="mb-1 mt-3 text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted">В сила от {LEGAL_UPDATED}</p>
        <p className="rounded-card bg-brand-bg p-3 text-sm">
          <strong>Доставчик:</strong>{" "}
          {c.name ? `${c.name}${c.eik ? `, ЕИК ${c.eik}` : ""}${c.address ? `, ${c.address}` : ""}` : "Ко Манда"}
          {c.email && (
            <>
              {" · "}
              <a href={`mailto:${c.email}`} className="text-brand-primary">
                {c.email}
              </a>
            </>
          )}
          {c.phone && ` · ${c.phone}`}
        </p>
        {children}
      </article>
    </div>
  );
}
