export type ApprovalStatus = "pending" | "active" | "rejected";

export type AdminProperty = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  kind: string | null;
  lat: number;
  lng: number;
  geofence_m: number | null;
  access_notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  assigned_inspector_id: string | null;
  inspector_name: string | null;
  approval_status: ApprovalStatus;
  rejection_reason: string | null;
  /** Оперативен статус: ok | warning | overdue | in_progress | pending | rejected */
  status: string;
  created_at: string | null;
};

export type JobStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type AdminJob = {
  id: string;
  title: string | null;
  status: JobStatus;
  planned_at: string;
  property_id: string;
  check_in?: string | null;
  property_name: string | null;
  property_address: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  plan_id: string | null;
  template_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  itemsChecked: number;
  itemsTotal: number;
  photoCount: number;
  note: string | null;
  rescheduled_from: string | null;
};

export type OfferDecision = "pending" | "accepted" | "declined" | "paid" | "in_progress" | "done" | "expired";

export type AdminOffer = {
  id: string;
  finding_id: string;
  price: number | null;
  days: number | null;
  scope: string | null;
  sent_at: string | null;
  expires_at: string | null;
  decision: OfferDecision;
  requires_prepayment: boolean;
  awaits_payment: boolean;
  done_at: string | null;
  paid_at: string | null;
  photos: { id: string; storage_path: string }[];
  finding: {
    id: string;
    title: string;
    severity: string | null;
    status: string | null;
    property_id: string;
    property_name: string;
  };
};

export type AdminFinding = {
  id: string;
  property_id: string;
  property_name: string;
  job_id: string | null;
  title: string;
  body: string | null;
  severity: "normal" | "urgent";
  status: "open" | "quote_requested" | "quoted" | "closed";
  created_at: string | null;
  quote_requested_at: string | null;
  reporter_name: string | null;
  photos: { id: string; url: string }[];
  job_item: { label: string; zone_label: string | null } | null;
  offer: { id: string; decision: OfferDecision; price: number | null } | null;
};

export type AdminPlan = {
  id: string;
  property_id: string;
  property_name: string;
  property_address: string | null;
  property_status: ApprovalStatus;
  contact_name: string | null;
  contact_phone: string | null;
  assigned_inspector_id: string | null;
  owner_name: string | null;
  owner_email: string;
  owner_phone: string | null;
  package_id: string | null;
  package_name: string | null;
  name: string;
  per_month: number | null;
  price: number | null;
  options: string | null;
  status: "pending_payment" | "requested" | "active" | "cancelled";
  active: boolean | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  paid_until: string | null;
  first_job_at: string | null;
  ends_at: string | null;
  cancelled_at: string | null;
  started_at: string | null;
  options_snapshot: string | null;
  season_from: string | null;
  season_to: string | null;
  billing_paused_until: string | null;
  suspended_at: string | null;
  /** Ден на просрочие на превода (0 — няма); сезонът е отчетен на сървъра. */
  overdue_days: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "client" | "inspector";
  active: boolean;
  created_at: string | null;
};

export type CatalogItem = {
  id: string;
  template_id: string;
  template_name: string;
  category: string;
  per_month: number;
  optional: boolean;
  extra_price: number;
  steps: number;
};

export type CatalogPackage = {
  id: string;
  name: string;
  description: string | null;
  per_month: number;
  price: number;
  list_price: number | null;
  active_from: string | null;
  active_to: string | null;
  archived: boolean | null;
  sort: number | null;
  in_season: boolean;
  items: CatalogItem[];
};

export type ServiceTemplate = {
  id: string;
  name: string;
  category: string;
  archived: boolean | null;
  /** Точките от чек-листа (идват с /api/templates) — за обобщението в пакета. */
  items?: { season: string | null }[];
};

export type AdminPayment = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  offer_id: string | null;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "refund_needed" | "refunded" | "failed";
  method: string;
  description: string;
  reference: string | null;
  plan_id?: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  paid_at: string | null;
  created_at: string | null;
};

export type Inquiry = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  property_kind: string | null;
  service: string | null;
  message: string | null;
  status: "new" | "contacted" | "converted" | "closed";
  created_at: string | null;
};
