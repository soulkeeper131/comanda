// Общи типове за клиентския екран ("Моят имот"). Държим ги свободни (не
// строго свързани със схемата), защото идват от няколко различни API
// route-а с леко различна форма на отговора.

export type ClientProperty = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  kind?: string | null;
  status: "ok" | "warning" | "overdue" | "in_progress";
};

export type ClientJob = {
  id: string;
  title: string | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  planned_at: string;
  property_id: string;
  property_name?: string;
  started_at?: string | null;
  completed_at?: string | null;
  itemsChecked?: number;
  itemsTotal?: number;
  photoCount?: number;
};

export type ClientOffer = {
  id: string;
  price: number | null;
  days: number | null;
  scope: string | null;
  sent_at: string;
  decision: "pending" | "accepted" | "declined" | "paid" | "in_progress" | "done";
  finding: {
    id: string;
    title: string;
    body: string | null;
    status: string;
    property_id: string;
    property_name: string;
    created_at: string;
  } | null;
};

export type ClientPlan = {
  id: string;
  property_id: string;
  template_id: string;
  name: string;
  per_month: number | null;
  price: number | null;
  active: boolean | null;
  started_at: string | null;
};

export type ServiceTemplate = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  icon: string | null;
  duration_min: number | null;
  price: number | null;
  bookable: boolean | null;
  archived: boolean | null;
  items: unknown[];
};

export type OverrideRecord = {
  id: string;
  admin_id: string;
  entity_type: "job_item" | "job_checkin";
  entity_id: string;
  reason: string;
  created_at: string | null;
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
  photos: JobItemPhoto[];
};

export type JobDetail = ClientJob & {
  property_address?: string | null;
  assignee_name?: string | null;
  items: JobItemDetail[];
  photos: JobItemPhoto[];
};

export function photoUrl(storagePath: string): string {
  const name = storagePath.split("/").pop() || storagePath;
  return `/api/photos/${name}`;
}
