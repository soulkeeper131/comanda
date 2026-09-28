"use client";

import { Section } from "./Section";
import { JobPhotosByStep, countPhotos, useJobDetail } from "./JobPhotos";
import { formatWhen } from "./format";
import type { ClientJob } from "./types";

/**
 * „Последен обход" — обещанието на продукта: клиентът ВИЖДА доказателството.
 * Затова е най-отгоре и със снимките по стъпки.
 */
export default function LastVisitSection({ job }: { job: ClientJob | null }) {
  const detail = useJobDetail(job?.id ?? null);

  return (
    <Section title="Последен обход" icon="camera" emphasis>
      {!job ? (
        <p className="text-sm text-muted">
          Още няма завършени обходи. Първият ще се появи тук със снимките от всяка проверена точка.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-lg font-bold text-ink">{job.title || "Обход"}</div>
            <div className="text-sm text-muted">
              Завършен {formatWhen(job.completed_at || job.planned_at)}
              {job.assignee_name ? ` · ${job.assignee_name}` : ""}
            </div>
            {detail.job && (
              <div className="mt-1 text-sm text-ink-2">
                Проверени {detail.job.items.filter((i) => i.done).length} от {detail.job.items.length} точки ·{" "}
                {countPhotos(detail.job)} снимки
              </div>
            )}
          </div>
          <JobPhotosByStep state={detail} />
        </div>
      )}
    </Section>
  );
}
