// Типовете на клиентския екран ("Моят имот"). Следват отговорите на API-то
// след пренаписването (одобрение на имот, каталог с пакети, двата потока
// на плащане по оферта).

export type ApprovalStatus = "pending" | "active" | "rejected";

export type ClientProperty = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  kind?: string | null;
  /** Оперативен статус; за неодобрен имот е "pending" / "rejected". */
  status: "ok" | "warning" | "overdue" | "in_progress" | "pending" | "rejected";
  approval_status: ApprovalStatus;
  rejection_reason?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  access_notes?: string | null;
  inspector_name?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type JobStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type ClientJob = {
  id: string;
  title: string | null;
  status: JobStatus;
  /** Често само дата "YYYY-MM-DD" — обходът е за деня, без час. */
  plan_id?: string | null;
  planned_at: string;
  property_id: string;
  property_name?: string;
  started_at?: string | null;
  completed_at?: string | null;
  itemsChecked?: number;
  itemsTotal?: number;
  photoCount?: number;
  rescheduled_from?: string | null;
  assignee_name?: string | null;
};

export type JobPhoto = {
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
  photos: JobPhoto[];
};

export type JobDetail = ClientJob & {
  property_address?: string | null;
  items: JobItemDetail[];
  photos: JobPhoto[];
};

export type OverrideRecord = {
  id: string;
  admin_id: string;
  entity_type: "job_item" | "job_checkin";
  entity_id: string;
  reason: string;
  created_at: string | null;
};

export type PlanStatus = "pending_payment" | "requested" | "active" | "cancelled";

export type ClientPlan = {
  id: string;
  property_id: string;
  package_id?: string | null;
  name: string;
  package_name?: string | null;
  per_month: number | null;
  price: number | null;
  /** JSON низ — масив от id-та на package_items (избраните опции). */
  options?: string | null;
  status: PlanStatus;
  active?: boolean | null;
  first_job_at?: string | null;
  ends_at?: string | null;
  cancelled_at?: string | null;
  started_at?: string | null;
  stripe_subscription_id?: string | null;
  stripe_status?: string | null;
  paid_until?: string | null;
  /** Избраните опции, както са били при заявката (с имената). */
  options_snapshot?: string | null;
  /** Сезонен пакет — "MM-DD"; плаща се и се обслужва само в сезона. */
  season_from?: string | null;
  season_to?: string | null;
  /** Картата не се таксува до тази дата (извън сезона). */
  billing_paused_until?: string | null;
  /** Обходите са спрени — преводът закъснява с повече от 14 дни. */
  suspended_at?: string | null;
};

export type PackageItem = {
  id: string;
  template_id?: string;
  template_name: string;
  category: string;
  description: string | null;
  per_month: number;
  optional: boolean;
  extra_price: number;
  steps: number;
  checklist?: { zone: string | null; label: string; season: "all" | "winter" | "summer" }[];
};

export type CatalogPackage = {
  id: string;
  name: string;
  description: string | null;
  per_month: number;
  price: number;
  list_price: number | null;
  /** "MM-DD" или null — сезонен пакет */
  active_from: string | null;
  active_to: string | null;
  in_season: boolean;
  items: PackageItem[];
};

export type Severity = "normal" | "urgent";
export type FindingStatus = "open" | "quote_requested" | "quoted" | "closed";

export type OfferDecision =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "paid"
  | "in_progress"
  | "done";

export type ClientFinding = {
  id: string;
  property_id: string;
  title: string;
  body: string | null;
  severity: Severity;
  status: FindingStatus;
  created_at: string | null;
  reporter_name: string | null;
  photos: { id: string; url: string; storage_path?: string }[];
  offer: {
    id: string;
    decision: OfferDecision;
    price: number | null;
    days: number | null;
    scope: string | null;
    expires_at: string | null;
  } | null;
};

export type ClientOffer = {
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
  done_at?: string | null;
  paid_at?: string | null;
  photos: JobPhoto[];
  finding: {
    id: string;
    title: string;
    severity: Severity;
    property_id: string;
    property_name: string;
  } | null;
};

export type ClientPayment = {
  id: string;
  offer_id: string | null;
  plan_id?: string | null;
  amount: number;
  method: string;
  status: string;
  created_at: string | null;
};
