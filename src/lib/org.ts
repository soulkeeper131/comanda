import { db } from "@/db";
import { organizations } from "@/db/schema";

/**
 * Връща id-то на единствената организация в системата.
 *
 * Засега поддържаме само една организация (виж процесните решения) —
 * затова не приемаме org_id отвън тук, а винаги четем реалния запис
 * от базата, вместо да гадаем константа като "org1".
 */
export function getDefaultOrgId(): string {
  const org = db.select({ id: organizations.id }).from(organizations).limit(1).get();
  if (!org) {
    throw new Error("Няма създадена организация. Пусни `npm run db:seed`.");
  }
  return org.id;
}
