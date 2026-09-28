"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Section } from "./Section";
import { JobPhotosByStep, useJobDetail } from "./JobPhotos";
import { formatWhen } from "./format";
import type { ClientJob } from "./types";

const PAGE = 5;

/** Предишните завършени обходи — докосване разгъва снимките по стъпки. */
export default function HistorySection({ jobs }: { jobs: ClientJob[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  return (
    <Section title="История" icon="list">
      {jobs.length === 0 ? (
        <p className="text-sm text-muted">Тук ще се натрупват предишните обходи.</p>
      ) : (
        <ul className="divide-y divide-line">
          {jobs.slice(0, shown).map((job) => {
            const open = openId === job.id;
            return (
              <li key={job.id}>
                <button
                  onClick={() => setOpenId(open ? null : job.id)}
                  className="flex min-h-touch w-full items-center gap-3 py-2 text-left"
                  aria-expanded={open}
                >
                  <Icon name="check-circle" size={18} className="text-state-ok" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{job.title || "Обход"}</div>
                    <div className="text-xs text-muted">
                      {formatWhen(job.completed_at || job.planned_at)}
                      {typeof job.photoCount === "number" ? ` · ${job.photoCount} снимки` : ""}
                    </div>
                  </div>
                  <Icon
                    name="chevron-down"
                    size={18}
                    className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <div className="pb-3">
                    <HistoryDetail jobId={job.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {jobs.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-2 min-h-touch w-full text-sm font-semibold text-brand-primary"
        >
          Покажи още ({jobs.length - shown})
        </button>
      )}
    </Section>
  );
}

function HistoryDetail({ jobId }: { jobId: string }) {
  const state = useJobDetail(jobId);
  return <JobPhotosByStep state={state} />;
}
