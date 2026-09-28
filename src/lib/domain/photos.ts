import { db } from "@/db";
import { evidence, jobs, findingPhotos, findings, offerPhotos, offers } from "@/db/schema";
import { eq, inArray, like, or } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export type PhotoLookupRows = {
  evidence: { storage_path: string; job_id: string }[];
  jobs: { id: string; property_id: string }[];
  findingPhotos: { storage_path: string; finding_id: string }[];
  findings: { id: string; property_id: string }[];
  /** Снимки от майстора към оферта (въпрос 23): снимка → оферта → констатация → имот. */
  offerPhotos?: { storage_path: string; offer_id: string }[];
  offers?: { id: string; finding_id: string }[];
};

/** Кой имот притежава тази снимка? Търси и в трите източника. */
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

  const op = rows.offerPhotos?.find((p) => matches(p.storage_path));
  if (op) {
    const offer = rows.offers?.find((o) => o.id === op.offer_id);
    const finding = offer && rows.findings.find((f) => f.id === offer.finding_id);
    return finding?.property_id ?? null;
  }

  return null;
}

/**
 * Обвивка, която чете от базата и делегира на чистата функция. Чете само
 * редовете за този файл — не цели таблици при всяка заявка за снимка.
 */
export function propertyIdForPhoto(filename: string): string | null {
  const pathMatch = (col: AnySQLiteColumn) => or(eq(col, filename), like(col, `%/${filename}`));

  const ev = db
    .select({ storage_path: evidence.storage_path, job_id: evidence.job_id })
    .from(evidence)
    .where(pathMatch(evidence.storage_path))
    .all();
  const fp = db
    .select({ storage_path: findingPhotos.storage_path, finding_id: findingPhotos.finding_id })
    .from(findingPhotos)
    .where(pathMatch(findingPhotos.storage_path))
    .all();
  const op = db
    .select({ storage_path: offerPhotos.storage_path, offer_id: offerPhotos.offer_id })
    .from(offerPhotos)
    .where(pathMatch(offerPhotos.storage_path))
    .all();

  const jobIds = ev.map((e) => e.job_id);
  const offerRows = op.length
    ? db
        .select({ id: offers.id, finding_id: offers.finding_id })
        .from(offers)
        .where(inArray(offers.id, op.map((o) => o.offer_id)))
        .all()
    : [];
  const findingIds = [...fp.map((f) => f.finding_id), ...offerRows.map((o) => o.finding_id)];

  return resolveOwningProperty(filename, {
    evidence: ev,
    jobs: jobIds.length
      ? db.select({ id: jobs.id, property_id: jobs.property_id }).from(jobs).where(inArray(jobs.id, jobIds)).all()
      : [],
    findingPhotos: fp,
    findings: findingIds.length
      ? db
          .select({ id: findings.id, property_id: findings.property_id })
          .from(findings)
          .where(inArray(findings.id, findingIds))
          .all()
      : [],
    offerPhotos: op,
    offers: offerRows,
  });
}
