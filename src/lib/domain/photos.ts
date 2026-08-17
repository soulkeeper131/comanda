import { db } from "@/db";
import { evidence, jobs, findingPhotos, findings } from "@/db/schema";

export type PhotoLookupRows = {
  evidence: { storage_path: string; job_id: string }[];
  jobs: { id: string; property_id: string }[];
  findingPhotos: { storage_path: string; finding_id: string }[];
  findings: { id: string; property_id: string }[];
};

/** Кой имот притежава тази снимка? Търси и в двата източника. */
export function resolveOwningProperty(
  filename: string,
  rows: PhotoLookupRows,
): string | null {
  const matches = (storagePath: string) =>
    storagePath.endsWith(`/${filename}`) || storagePath === filename;

  const ev = rows.evidence.find((e) => matches(e.storage_path));
  if (ev) {
    const job = rows.jobs.find((j) => j.id === ev.job_id);
    return job?.property_id ?? null;
  }

  const fp = rows.findingPhotos.find((p) => matches(p.storage_path));
  if (fp) {
    const finding = rows.findings.find((f) => f.id === fp.finding_id);
    return finding?.property_id ?? null;
  }

  return null;
}

/** Обвивка, която чете от базата и делегира на чистата функция. */
export function propertyIdForPhoto(filename: string): string | null {
  return resolveOwningProperty(filename, {
    evidence: db
      .select({ storage_path: evidence.storage_path, job_id: evidence.job_id })
      .from(evidence)
      .all(),
    jobs: db
      .select({ id: jobs.id, property_id: jobs.property_id })
      .from(jobs)
      .all(),
    findingPhotos: db
      .select({
        storage_path: findingPhotos.storage_path,
        finding_id: findingPhotos.finding_id,
      })
      .from(findingPhotos)
      .all(),
    findings: db
      .select({ id: findings.id, property_id: findings.property_id })
      .from(findings)
      .all(),
  });
}
