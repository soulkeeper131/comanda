// Типове за инспекторския екран ("Моите обходи"). Отделени от
// src/features/client/types.ts, защото инспекторът вижда различна форма на
// същите обекти (assignee вместо клиент, липсва цена/оферта).

export type InspectorJob = {
  id: string;
  title: string | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  /** Обикновено само дата ("2026-10-01") — обходът е за деня, без час. */
  planned_at: string;
  property_id: string;
  property_name?: string | null;
  property_address?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  itemsChecked?: number;
  itemsTotal?: number;
  photoCount?: number;
  rescheduled_from?: string | null;
};

export type JobItemPhoto = {
  id: string;
  storage_path: string;
  taken_at: string | null;
  /** Снимана офлайн — показва се от устройството, още не е на сървъра. */
  localBlobKey?: string;
};

export type JobItemDetail = {
  id: string;
  label: string;
  zone_label: string | null;
  done: boolean | null;
  required: boolean | null;
  evidence_type?: string | null;
  photos: JobItemPhoto[];
  /** Отметката чака синхронизация. */
  pendingTick?: boolean;
};

export type JobDetail = InspectorJob & {
  property_lat?: number | null;
  property_lng?: number | null;
  access_notes?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  items: JobItemDetail[];
  photos: JobItemPhoto[];
};

export { photoUrl } from "@/lib/format";
