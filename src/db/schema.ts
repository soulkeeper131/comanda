import { sqliteTable, text, integer, real, index, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
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
  // Адрес за фактурата (на регистрация за фирма) — ЗДДС чл. 114, ал. 1, т. 4
  billing_address: text("billing_address"),
  active: integer("active", { mode: "boolean" }).default(true),
  // Потвърден имейл — без него клиентът не влиза (грешен адрес значи клиент,
  // който не получава оферти и фактури).
  email_verified_at: text("email_verified_at"),
  // Съгласие с общите условия и политиката за лични данни (GDPR)
  terms_accepted_at: text("terms_accepted_at"),
  terms_version: text("terms_version"),
  stripe_customer_id: text("stripe_customer_id"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
  updated_at: text("updated_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Еднократни токени по имейл: потвърждение на адрес, нова парола.
// Пази се само хешът — изтекла база не дава работещи линкове.
// ============================================================
export const authTokens = sqliteTable("auth_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").references(() => users.id).notNull(),
  type: text("type").$type<"verify_email" | "reset_password">().notNull(),
  token_hash: text("token_hash").notNull().unique(),
  expires_at: text("expires_at").notNull(),
  used_at: text("used_at"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Качени файлове — кой ги е качил и дали вече са закачени. Снимка се
// приема като доказателство само от този, който я е качил, и само веднъж.
// ============================================================
export const uploads = sqliteTable("uploads", {
  filename: text("filename").primaryKey(),
  user_id: text("user_id").references(() => users.id).notNull(),
  attached_at: text("attached_at"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
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
  // Одобрение от админ (въпрос 24): клиентът добавя → pending → active/rejected.
  // Съществуващите имоти са "active" по подразбиране.
  status: text("status").$type<"pending" | "active" | "rejected">().default("active"),
  rejection_reason: text("rejection_reason"),
  approved_by: text("approved_by").references((): AnySQLiteColumn => users.id),
  approved_at: text("approved_at"),
  // Контакт без акаунт (въпрос 27) — на когото инспекторът се обажда за достъп.
  contact_name: text("contact_name"),
  contact_phone: text("contact_phone"),
  // Инспекторът е на ниво имот (въпрос 10) — генераторът го копира в задачите.
  assigned_inspector_id: text("assigned_inspector_id").references((): AnySQLiteColumn => users.id),
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
  // Кога се проверява точката: целогодишно, само зимата (окт–апр) или
  // само лятото (май–сеп) — чек-листът на обхода следва сезона.
  season: text("season").$type<"all" | "winter" | "summer">().default("all"),
});

// ============================================================
// Пакети (каталог) — въпроси 1, 2, 3, 6
// Пакет = фиксирана месечна цена + ядро (обход) + опции (напр. почистване).
// ============================================================
export const packages = sqliteTable("packages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  org_id: text("org_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // Обходи месечно за ядрото: 1 / 2 / 4
  per_month: integer("per_month").notNull().default(2),
  // Фиксирана месечна цена (с отстъпката вече приложена)
  price: real("price").notNull().default(0),
  // Сбор без отстъпка — само за показване („спестявате X")
  list_price: real("list_price"),
  // Сезонен прозорец като "MM-DD" (включително). Празно = целогодишно.
  active_from: text("active_from"),
  active_to: text("active_to"),
  archived: integer("archived", { mode: "boolean" }).default(false),
  sort: integer("sort").default(0),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

export const packageItems = sqliteTable("package_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  package_id: text("package_id").references(() => packages.id).notNull(),
  template_id: text("template_id").references(() => serviceTemplates.id).notNull(),
  per_month: integer("per_month").notNull().default(1),
  // false = ядро (винаги включено), true = опция по избор на клиента
  optional: integer("optional", { mode: "boolean" }).default(false),
  // Добавка към месечната цена, когато опцията е избрана
  extra_price: real("extra_price").default(0),
  sort: integer("sort").default(0),
});

// ============================================================
// Абонаментни планове
// ============================================================
export const plans = sqliteTable("plans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  property_id: text("property_id").references(() => properties.id).notNull(),
  template_id: text("template_id").references(() => serviceTemplates.id).notNull(),
  package_id: text("package_id").references(() => packages.id),
  name: text("name").notNull(),
  per_month: integer("per_month").default(4),
  price: real("price").default(0),
  // JSON масив с id-та на избраните опционални package_items
  options: text("options"),
  // Снимка на пакета към момента на заявката — последващи промени в
  // каталога не пипат вече платени абонаменти. JSON: [{template_id, per_month}]
  options_snapshot: text("options_snapshot"),
  season_from: text("season_from"),
  season_to: text("season_to"),
  // Stripe абонамент (N9)
  stripe_subscription_id: text("stripe_subscription_id"),
  // Последната отворена страница за плащане — за да не се плати два пъти
  // и да се затвори, щом планът бъде отказан или платен по банка.
  stripe_checkout_session_id: text("stripe_checkout_session_id"),
  // Сезонен абонамент с карта: таксуването в Stripe е на пауза до тази дата
  // (началото на следващия сезон) — извън сезона не се тегли нищо.
  billing_paused_until: text("billing_paused_until"),
  // Абонамент по банка без плащане над 14 дни: обходите са спрени до превода.
  suspended_at: text("suspended_at"),
  stripe_status: text("stripe_status"),
  paid_until: text("paid_until"),
  active: integer("active", { mode: "boolean" }).default(true),
  // pending_payment → клиентът още не е платил; requested → платен, чака
  // админ да насрочи първия обход; active → генерира; cancelled → работи до
  // ends_at, после спира (въпрос 5).
  status: text("status").$type<"pending_payment" | "requested" | "active" | "cancelled">().default("active"),
  // До попълването му планът не генерира (въпрос 7)
  first_job_at: text("first_job_at"),
  cancelled_at: text("cancelled_at"),
  ends_at: text("ends_at"),
  started_at: text("started_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Задачи / посещения
// ============================================================
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    org_id: text("org_id").references(() => organizations.id).notNull(),
    property_id: text("property_id").references(() => properties.id).notNull(),
    plan_id: text("plan_id").references(() => plans.id),
    template_id: text("template_id").references(() => serviceTemplates.id),
    assignee_id: text("assignee_id").references(() => users.id),
    title: text("title"),
    duration_min: integer("duration_min"),
    planned_at: text("planned_at").notNull(),
    // Кога е пратено напомнянето „утре е обход" — за да не се праща всеки час.
    reminder_sent_at: text("reminder_sent_at"),
    status: text("status")
      .$type<"planned" | "in_progress" | "completed" | "cancelled">()
      .default("planned"),
    check_in: text("check_in"),
    check_out: text("check_out"),
    // Координати при чекин — техническата основа на геофенсинга (Task 14).
    check_in_lat: real("check_in_lat"),
    check_in_lng: real("check_in_lng"),
    // Офлайн: времето на устройството при чекин (не е доверено — check_in е
    // времето на сървъра при получаване).
    check_in_client_at: text("check_in_client_at"),
    note: text("note"),
    // Генератор (N7): идемпотентност по (план, услуга, поредност), не по дата —
    // клиентът може да мести обходи, без генераторът да ги дублира.
    gen_key: text("gen_key"),
    rescheduled_at: text("rescheduled_at"),
    rescheduled_by: text("rescheduled_by").references(() => users.id),
    rescheduled_from: text("rescheduled_from"),
    created_at: text("created_at").default(sql`(datetime('now'))`),
  },
  (t) => ({
    genKeyIdx: uniqueIndex("jobs_gen_key_idx").on(t.gen_key),
    propertyIdx: index("jobs_property_idx").on(t.property_id),
    assigneeIdx: index("jobs_assignee_idx").on(t.assignee_id),
    statusIdx: index("jobs_status_idx").on(t.status),
  }),
);

// ============================================================
// Стъпки в задача (копирани от шаблон)
// ============================================================
export const jobItems = sqliteTable(
  "job_items",
  {
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
    // Снимката, която доказва изпълнението на стъпката (задължително доказателство — Task 15).
    // Кръгова връзка с evidence — изричен тип чупи circular inference-а на TS.
    evidence_id: text("evidence_id").references((): AnySQLiteColumn => evidence.id),
    // Кога е отметната: done_at — сървърно време; done_client_at — от
    // устройството (офлайн опашката записва момента на действието).
    done_at: text("done_at"),
    done_client_at: text("done_client_at"),
  },
  (t) => ({
    jobIdx: index("job_items_job_idx").on(t.job_id),
  }),
);

// ============================================================
// Снимкови доказателства
// ============================================================
export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    job_id: text("job_id").references(() => jobs.id).notNull(),
    job_item_id: text("job_item_id").references(() => jobItems.id),
    storage_path: text("storage_path").notNull(),
    taken_at: text("taken_at").default(sql`(datetime('now'))`),
    lat: real("lat"),
    lng: real("lng"),
    // Кога е снимано според устройството (офлайн) — taken_at е получаването.
    client_taken_at: text("client_taken_at"),
    uploaded_by: text("uploaded_by").references(() => users.id),
  },
  (t) => ({
    jobIdx: index("evidence_job_idx").on(t.job_id),
  }),
);

// ============================================================
// Констатации / проблеми
// ============================================================
export const findings = sqliteTable(
  "findings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    org_id: text("org_id").references(() => organizations.id).notNull(),
    property_id: text("property_id").references(() => properties.id).notNull(),
    job_id: text("job_id").references(() => jobs.id),
    job_item_id: text("job_item_id").references(() => jobItems.id),
    reported_by: text("reported_by").references(() => users.id),
    title: text("title").notNull(),
    body: text("body"),
    // urgent вдига тревога веднага до админ и собственик (въпрос 17)
    severity: text("severity").$type<"normal" | "urgent">().default("normal"),
    // open → quote_requested → quoted → closed (въпрос 19)
    status: text("status")
      .$type<"open" | "quote_requested" | "quoted" | "closed">()
      .default("open"),
    quote_requested_at: text("quote_requested_at"),
    created_at: text("created_at").default(sql`(datetime('now'))`),
  },
  (t) => ({
    propertyIdx: index("findings_property_idx").on(t.property_id),
  }),
);

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
export const offers = sqliteTable(
  "offers",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    finding_id: text("finding_id").references(() => findings.id).notNull(),
    price: real("price"),
    days: integer("days"),
    scope: text("scope"),
    sent_at: text("sent_at").default(sql`(datetime('now'))`),
    decision: text("decision")
      .$type<"pending" | "accepted" | "declined" | "paid" | "in_progress" | "done" | "expired">()
      .default("pending"),
    created_by: text("created_by").references(() => users.id),
    // Потокът на плащане се решава веднъж, при създаването — смяна на прага
    // по-късно не бива да „заключи" вече тръгнала оферта.
    requires_prepayment: integer("requires_prepayment", { mode: "boolean" }),
    // Валидна 7 дни (въпрос 21); след това cron скриптът я маркира expired.
    expires_at: text("expires_at"),
    decided_at: text("decided_at"),
    done_at: text("done_at"),
    paid_at: text("paid_at"),
    // Колко напомняния вече са пратени — пази от повторно пращане
    reminders_sent: integer("reminders_sent").default(0),
    payment_reminders_sent: integer("payment_reminders_sent").default(0),
  },
  (t) => ({
    findingIdx: index("offers_finding_idx").on(t.finding_id),
  }),
);

// ============================================================
// Еднократни допълнителни услуги (уточнение 6б) — „този месец и
// прозорците": заявява се веднъж, плаща се веднъж, става един обход.
// ============================================================
export const serviceOrders = sqliteTable("service_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  property_id: text("property_id").references(() => properties.id).notNull(),
  template_id: text("template_id").references(() => serviceTemplates.id).notNull(),
  requested_by: text("requested_by").references(() => users.id).notNull(),
  requested_date: text("requested_date").notNull(),
  note: text("note"),
  price: real("price").notNull(),
  // pending_payment → paid (обходът е създаден) | cancelled
  status: text("status").$type<"pending_payment" | "paid" | "cancelled">().default("pending_payment"),
  job_id: text("job_id").references(() => jobs.id),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Снимки към оферта (ремонт) — качва ги админът от майстора (въпрос 23)
// ============================================================
export const offerPhotos = sqliteTable("offer_photos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  offer_id: text("offer_id").references(() => offers.id).notNull(),
  storage_path: text("storage_path").notNull(),
  uploaded_by: text("uploaded_by").references(() => users.id),
  taken_at: text("taken_at").default(sql`(datetime('now'))`),
});

// ============================================================
// Преместване на обход от клиента (въпрос 11) — кой, кога, от коя на коя
// ============================================================
export const jobReschedules = sqliteTable("job_reschedules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  job_id: text("job_id").references(() => jobs.id).notNull(),
  user_id: text("user_id").references(() => users.id).notNull(),
  from_date: text("from_date").notNull(),
  to_date: text("to_date").notNull(),
  created_at: text("created_at").default(sql`(datetime('now'))`),
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
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    user_id: text("user_id").references(() => users.id).notNull(),
    type: text("type").notNull(), // job_started/job_done/finding_new/offer_new/offer_decided
    title: text("title").notNull(),
    body: text("body"),
    read: integer("read", { mode: "boolean" }).default(false),
    link: text("link"),
    created_at: text("created_at").default(sql`(datetime('now'))`),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.user_id),
  }),
);

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
  order_id: text("order_id").references((): AnySQLiteColumn => serviceOrders.id),
  // Месечно плащане по абонамент (карта през Stripe или банков превод)
  plan_id: text("plan_id").references((): AnySQLiteColumn => plans.id),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"),
  method: text("method").notNull().default("card"),
  stripe_session_id: text("stripe_session_id"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  // Колко напомняния за неплатен превод са изпратени (абонамент по банка).
  reminders_sent: integer("reminders_sent").default(0),
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
export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    user_id: text("user_id").references(() => users.id).notNull(),
    payment_id: text("payment_id").references(() => payments.id),
    number: text("number").notNull(),
    amount: real("amount"),
    description: text("description"),
    pdf_path: text("pdf_path"),
    // Кредитно известие: сочи фактурата, която сторнира (сумата е отрицателна).
    credit_for: text("credit_for"),
    // Данните на купувача към датата на издаване — фактурата не се мени,
    // ако клиентът после смени името си или изтрие профила.
    buyer_name: text("buyer_name"),
    buyer_email: text("buyer_email"),
    buyer_company: text("buyer_company"),
    buyer_eik: text("buyer_eik"),
    buyer_vat: text("buyer_vat"),
    buyer_address: text("buyer_address"),
    created_at: text("created_at").default(sql`(datetime('now'))`),
  },
  (t) => ({
    numberIdx: uniqueIndex("invoices_number_idx").on(t.number),
    paymentIdx: uniqueIndex("invoices_payment_idx").on(t.payment_id),
  }),
);

// ============================================================
// Админски прескачания (override на геофенсинг / задължително доказателство)
// Записва кой, кога и защо е прескочил проверка — не е безшумно.
// ============================================================
export const overrides = sqliteTable("overrides", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  admin_id: text("admin_id").references(() => users.id).notNull(),
  entity_type: text("entity_type").$type<"job_item" | "job_checkin">().notNull(),
  entity_id: text("entity_id").notNull(),
  reason: text("reason").notNull(),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});
