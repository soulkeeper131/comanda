import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============================================================
// Организации
// ============================================================
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  accent: text("accent").default("#1b98e0"),
  settings: text("settings"), // JSON: { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, notify_email }
  created_at: text("created_at").default(sql`(datetime('now'))`),
  updated_at: text("updated_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Потребители
// ============================================================
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  org_id: text("org_id").references(() => organizations.id),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull().default("client"),
  full_name: text("full_name"),
  phone: text("phone"),
  company_name: text("company_name"),
  eik: text("eik"),
  vat_number: text("vat_number"),
  active: integer("active", { mode: "boolean" }).default(true),
  created_at: text("created_at").default(sql`(datetime('now'))`),
  updated_at: text("updated_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Имоти
// ============================================================
export const properties = sqliteTable("properties", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  org_id: text("org_id").references(() => organizations.id).notNull(),
  owner_id: text("owner_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  city: text("city"),
  address: text("address"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  geofence_m: integer("geofence_m").default(75),
  kind: text("kind").default("apartment"),
  access_notes: text("access_notes"),
  archived: integer("archived", { mode: "boolean" }).default(false),
  created_at: text("created_at").default(sql`(datetime('now'))`),
  updated_at: text("updated_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Зони в имот
// ============================================================
export const zones = sqliteTable("zones", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  property_id: text("property_id").references(() => properties.id).notNull(),
  name: text("name").notNull(),
  sort: integer("sort").default(0),
});

// ============================================================
// Сервизни шаблони (гъвкави пакети)
// ============================================================
export const serviceTemplates = sqliteTable("service_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  org_id: text("org_id").references(() => organizations.id).notNull(),
  category: text("category").notNull(), // cleaning, inspection, repair, conservation, custom
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").default("🧹"),
  duration_min: integer("duration_min").default(60),
  price: real("price").default(0),
  bookable: integer("bookable", { mode: "boolean" }).default(true),
  archived: integer("archived", { mode: "boolean" }).default(false),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Стъпки в шаблона (checklist items)
// ============================================================
export const templateItems = sqliteTable("template_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  template_id: text("template_id").references(() => serviceTemplates.id).notNull(),
  zone_label: text("zone_label"),
  label: text("label").notNull(),
  proof_type: text("proof_type").default("photo"),
  required: integer("required", { mode: "boolean" }).default(true),
  sort: integer("sort").default(0),
});

// ============================================================
// Абонаментни планове
// ============================================================
export const plans = sqliteTable("plans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  property_id: text("property_id").references(() => properties.id).notNull(),
  template_id: text("template_id").references(() => serviceTemplates.id).notNull(),
  name: text("name").notNull(),
  per_month: integer("per_month").default(4),
  price: real("price").default(0),
  active: integer("active", { mode: "boolean" }).default(true),
  started_at: text("started_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Задачи / посещения
// ============================================================
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  org_id: text("org_id").references(() => organizations.id).notNull(),
  property_id: text("property_id").references(() => properties.id).notNull(),
  plan_id: text("plan_id").references(() => plans.id),
  template_id: text("template_id").references(() => serviceTemplates.id),
  assignee_id: text("assignee_id").references(() => users.id),
  title: text("title"),
  duration_min: integer("duration_min"),
  planned_at: text("planned_at").notNull(),
  status: text("status").default("planned"),
  check_in: text("check_in"),
  check_out: text("check_out"),
  note: text("note"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Стъпки в задача (копирани от шаблон)
// ============================================================
export const jobItems = sqliteTable("job_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  job_id: text("job_id").references(() => jobs.id).notNull(),
  zone_label: text("zone_label"),
  label: text("label").notNull(),
  proof_type: text("proof_type").default("photo"),
  required: integer("required", { mode: "boolean" }).default(true),
  sort: integer("sort").default(0),
  done: integer("done", { mode: "boolean" }).default(false),
  count_value: integer("count_value"),
  note: text("note"),
});

// ============================================================
// Снимкови доказателства
// ============================================================
export const evidence = sqliteTable("evidence", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  job_id: text("job_id").references(() => jobs.id).notNull(),
  job_item_id: text("job_item_id").references(() => jobItems.id),
  storage_path: text("storage_path").notNull(),
  taken_at: text("taken_at").default(sql`(datetime('now'))`),
  lat: real("lat"),
  lng: real("lng"),
});

// ============================================================
// Констатации / проблеми
// ============================================================
export const findings = sqliteTable("findings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  org_id: text("org_id").references(() => organizations.id).notNull(),
  property_id: text("property_id").references(() => properties.id).notNull(),
  job_id: text("job_id").references(() => jobs.id),
  job_item_id: text("job_item_id").references(() => jobItems.id),
  reported_by: text("reported_by").references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  status: text("status").default("open"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Снимки към констатации
// ============================================================
export const findingPhotos = sqliteTable("finding_photos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  finding_id: text("finding_id").references(() => findings.id).notNull(),
  storage_path: text("storage_path").notNull(),
  taken_at: text("taken_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Оферти
// ============================================================
export const offers = sqliteTable("offers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  finding_id: text("finding_id").references(() => findings.id).notNull(),
  price: real("price"),
  days: integer("days"),
  scope: text("scope"),
  sent_at: text("sent_at").default(sql`(datetime('now'))`),
  decision: text("decision").default("pending"), // "pending"|"accepted"|"declined"|"paid"|"in_progress"|"done"
});

// ============================================================
// Запитвания от клиенти
// ============================================================
export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  full_name: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  property_kind: text("property_kind"),
  service: text("service"),
  message: text("message"),
  status: text("status").default("new"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Нотификации (in-app notification center)
// ============================================================
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // job_started/job_done/finding_new/offer_new/offer_decided
  title: text("title").notNull(),
  body: text("body"),
  read: integer("read", { mode: "boolean" }).default(false),
  link: text("link"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Push абонаменти (Web Push / VAPID)
// ============================================================
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").references(() => users.id),
  subscription: text("subscription").notNull(), // JSON string of PushSubscriptionJSON
  user_agent: text("user_agent"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Плащания
// ============================================================
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").references(() => users.id).notNull(),
  offer_id: text("offer_id").references(() => offers.id),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"),
  method: text("method").notNull().default("card"),
  stripe_session_id: text("stripe_session_id"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  paid_at: text("paid_at"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Настройки (key-value)
// ============================================================
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// ============================================================
// Фактури
// ============================================================
export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").references(() => users.id).notNull(),
  payment_id: text("payment_id").references(() => payments.id),
  number: text("number").notNull(),
  amount: real("amount"),
  description: text("description"),
  pdf_path: text("pdf_path"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});
