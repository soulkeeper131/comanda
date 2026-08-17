import { db } from "../src/db";
import { sql } from "drizzle-orm";
import readline from "node:readline/promises";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_RESET !== "yes") {
    console.error("Отказвам да изтрия продукционна база. Задай ALLOW_PROD_RESET=yes, ако наистина искаш.");
    process.exit(1);
  }

  const hasYesFlag = process.argv.includes("--yes");

  if (!process.stdin.isTTY && !hasYesFlag) {
    console.error(
      "Скриптът е пуснат неинтерактивно (без терминал).\n" +
      "Ако наистина искаш да изтриеш всички данни, добави --yes:\n" +
      "  npx tsx scripts/reset-db.ts --yes",
    );
    process.exit(1);
  }

  if (!hasYesFlag) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Това изтрива ВСИЧКИ данни. Напиши "да", за да продължиш: ');
    rl.close();

    if (answer.trim().toLowerCase() !== "да") {
      console.log("Отказано.");
      process.exit(0);
    }
  }

  db.run(sql`PRAGMA foreign_keys = OFF`);
  for (const table of [
    "overrides", "settings", "invoices", "payments", "push_subscriptions", "notifications",
    "inquiries", "offers", "finding_photos", "findings", "evidence",
    "job_items", "jobs", "plans", "template_items", "service_templates",
    "zones", "properties", "users", "organizations",
  ]) {
    const exists = db.get(
      sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`)
    );
    if (!exists) continue;
    db.run(sql.raw(`DELETE FROM ${table}`));
  }
  db.run(sql`PRAGMA foreign_keys = ON`);

  console.log("Базата е изчистена. Пусни `npm run db:seed`.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
