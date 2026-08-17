import { db } from "../src/db";
import { organizations, users, properties, serviceTemplates, templateItems } from "../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

function passwordFor(envKey: string): { value: string; generated: boolean } {
  const fromEnv = process.env[envKey];
  if (fromEnv) return { value: fromEnv, generated: false };
  return { value: crypto.randomBytes(12).toString("base64url"), generated: true };
}

async function main() {
  const existingOrg = db.select().from(organizations).where(eq(organizations.id, "org1")).get();
  if (!existingOrg) {
    db.insert(organizations).values({ id: "org1", name: "КОМАНДА", slug: "komanda" }).run();
    console.log("✓ Организация създадена");
  } else {
    console.log("· Организацията вече съществува, пропускам");
  }

  const seedUsers = [
    { id: "u1", email: "admin@komanda.bg", role: "admin" as const, name: "Админ", env: "SEED_ADMIN_PASSWORD" },
    { id: "u2", email: "client@komanda.bg", role: "client" as const, name: "Клиент", env: "SEED_CLIENT_PASSWORD" },
    { id: "u4", email: "inspector@komanda.bg", role: "inspector" as const, name: "Инспектор", env: "SEED_INSPECTOR_PASSWORD" },
  ];

  for (const u of seedUsers) {
    const found = db.select().from(users).where(eq(users.email, u.email)).get();
    if (found) {
      console.log(`· ${u.email} вече съществува, пропускам`);
      continue;
    }
    const { value, generated } = passwordFor(u.env);
    db.insert(users).values({
      id: u.id,
      org_id: "org1",
      email: u.email,
      password_hash: await bcrypt.hash(value, 10),
      role: u.role,
      full_name: u.name,
      active: true,
    }).run();
    console.log(`✓ ${u.email}${generated ? ` — парола: ${value}` : ""}`);
  }

  // Примерни имоти (собственик: клиентът u2)
  const existingProps = db.select().from(properties).all();
  if (existingProps.length === 0) {
    const props: [string, number, number, string][] = [
      ["ул. Цар Иван Асен II 12", 42.6934, 23.3247, "apartment"],
      ["бул. България 81", 42.6791, 23.3025, "apartment"],
      ["ул. Оборище 45", 42.6972, 23.3412, "house"],
      ["жк. Лозенец, ул. Златовръх 3", 42.6762, 23.3198, "apartment"],
      ["кв. Драгалевци, ул. Панорамен път 7", 42.6321, 23.3057, "house"],
    ];

    for (const [addr, lat, lng, kind] of props) {
      db.insert(properties).values({
        name: addr.split(",")[0].trim().replace(/^(ул\.|бул\.|жк\.|кв\.)\s*/, ""),
        address: `София, ${addr}`,
        lat,
        lng,
        kind,
        org_id: "org1",
        owner_id: "u2",
      }).run();
    }
    console.log(`✓ ${props.length} имота — създадени`);
  } else {
    console.log(`· Вече има ${existingProps.length} имота, пропускам`);
  }

  // Сервизни шаблони
  const existingTemplates = db.select().from(serviceTemplates).all();
  if (existingTemplates.length === 0) {
    const templates = [
      {
        id: "tpl1",
        category: "cleaning",
        name: "Основно почистване",
        description: "Прах, прахосмукачка, мокър под, баня, кухня",
        icon: "🧹",
        duration_min: 120,
        price: 80,
      },
      {
        id: "tpl2",
        category: "inspection",
        name: "Технически обход",
        description: "Проверка на ВиК, ел. инсталация, дограма, общо състояние",
        icon: "🔍",
        duration_min: 60,
        price: 50,
      },
      {
        id: "tpl3",
        category: "repair",
        name: "Дребни ремонти",
        description: "Смяна на крушки, уплътнения, дръжки, силикон",
        icon: "🔧",
        duration_min: 90,
        price: 100,
      },
    ];

    for (const t of templates) {
      db.insert(serviceTemplates).values({
        id: t.id,
        org_id: "org1",
        category: t.category,
        name: t.name,
        description: t.description,
        icon: t.icon,
        duration_min: t.duration_min,
        price: t.price,
        bookable: true,
        archived: false,
      }).run();
    }
    console.log(`✓ ${templates.length} сервизни шаблона — създадени`);
  } else {
    console.log(`· Вече има ${existingTemplates.length} шаблона, пропускам`);
  }

  // Стъпки в шаблоните
  const existingItems = db.select().from(templateItems).all();
  if (existingItems.length === 0) {
    const items = [
      // tpl1 — Основно почистване
      { id: "ti1", template_id: "tpl1", zone_label: "Всекидневна", label: "Прах по повърхности", proof_type: "photo", required: true, sort: 1 },
      { id: "ti2", template_id: "tpl1", zone_label: "Всекидневна", label: "Прахосмукачка", proof_type: "photo", required: true, sort: 2 },
      { id: "ti3", template_id: "tpl1", zone_label: "Всекидневна", label: "Мокър под", proof_type: "photo", required: true, sort: 3 },
      { id: "ti4", template_id: "tpl1", zone_label: "Кухня", label: "Плот и мивка", proof_type: "photo", required: true, sort: 4 },
      { id: "ti5", template_id: "tpl1", zone_label: "Кухня", label: "Котлони и абсорбатор", proof_type: "photo", required: true, sort: 5 },
      { id: "ti6", template_id: "tpl1", zone_label: "Баня", label: "Тоалетна и мивка", proof_type: "photo", required: true, sort: 6 },
      { id: "ti7", template_id: "tpl1", zone_label: "Баня", label: "Душ / вана", proof_type: "photo", required: true, sort: 7 },
      // tpl2 — Технически обход
      { id: "ti8", template_id: "tpl2", zone_label: "Баня", label: "Проверка за течове", proof_type: "photo", required: true, sort: 1 },
      { id: "ti9", template_id: "tpl2", zone_label: "Кухня", label: "Проверка на сифон и смесител", proof_type: "photo", required: true, sort: 2 },
      { id: "ti10", template_id: "tpl2", zone_label: "Общо", label: "Проверка на контакти и ключове", proof_type: "photo", required: true, sort: 3 },
      { id: "ti11", template_id: "tpl2", zone_label: "Общо", label: "Проверка на дограма", proof_type: "photo", required: true, sort: 4 },
      // tpl3 — Дребни ремонти
      { id: "ti12", template_id: "tpl3", zone_label: "Общо", label: "Смяна на изгорели крушки", proof_type: "photo", required: false, sort: 1 },
      { id: "ti13", template_id: "tpl3", zone_label: "Баня", label: "Силикон около вана / душ", proof_type: "photo", required: false, sort: 2 },
      { id: "ti14", template_id: "tpl3", zone_label: "Общо", label: "Смяна на уплътнения по врати", proof_type: "photo", required: false, sort: 3 },
    ];

    for (const item of items) {
      db.insert(templateItems).values({
        id: item.id,
        template_id: item.template_id,
        zone_label: item.zone_label,
        label: item.label,
        proof_type: item.proof_type,
        required: item.required,
        sort: item.sort,
      }).run();
    }
    console.log(`✓ ${items.length} стъпки в шаблони — създадени`);
  } else {
    console.log(`· Вече има ${existingItems.length} стъпки, пропускам`);
  }

  console.log("\nГотово.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed се провали:", e);
  process.exit(1);
});
