// Типове за инспекторския екран ("Моите обходи"). Отделени от
// src/features/client/types.ts, защото инспекторът вижда различна форма на
// същите обекти (assignee вместо клиент, липсва цена/оферта).

export type InspectorJob = {
  id: string;
  title: string | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  planned_at: string;
  property_id: string;
  property_name?: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  itemsChecked?: number;
  itemsTotal?: number;
  photoCount?: number;
};

export type JobItemPhoto = {
  id: string;
  storage_path: string;
  taken_at: string | null;
};

export type JobItemDetail = {
  id: string;
  label: string;
  zone_label: string | null;
  done: boolean | null;
  required: boolean | null;
  evidence_type?: string | null;
  photos: JobItemPhoto[];
};

export type JobDetail = InspectorJob & {
  property_address?: string | null;
  items: JobItemDetail[];
  photos: JobItemPhoto[];
};

export function photoUrl(storagePath: string): string {
  const name = storagePath.split("/").pop() || storagePath;
  return `/api/photos/${name}`;
}
