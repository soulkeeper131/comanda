import { db } from "@/db";
import { properties, jobs, findings, users } from "@/db/schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import { notify } from "@/lib/messages";
import { todaySofia } from "@/lib/jobs-generator";
import { withAuth, canViewProperty, propertyScope } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (_request, { session }) => {
  try {
    // Изтегляме всички неархивирани имоти, после филтрираме през canViewProperty
    // (админ — всичко, клиент — своите, инспектор — възложените и с негов обход).
    const scope = propertyScope(session);
    const all = db.select().from(properties)
      .where(eq(properties.archived, false))
      .all();
    // Инспекторът работи само по одобрени имоти; клиентът вижда своите
    // (и чакащите одобрение — с етикет), админът — всичко.
    const result = all
      .filter((p) => canViewProperty(session, p, scope))
      .filter((p) => session.role !== "inspector" || p.status === "active");

    const ownerIds = Array.from(new Set(result.map((p) => p.owner_id)));
    const inspectorIds = Array.from(
      new Set(result.map((p) => p.assigned_inspector_id).filter((x): x is string => !!x)),
    );
    const people = [...ownerIds, ...inspectorIds].length
      ? db
          .select({ id: users.id, full_name: users.full_name, email: users.email, phone: users.phone })
          .from(users)
          .where(inArray(users.id, [...ownerIds, ...inspectorIds]))
          .all()
      : [];
    const person = (id: string | null) => people.find((u) => u.id === id);

    // Статусът на имота се смята с 3 групови заявки (вместо до 3 на имот в цикъл).
    // Приоритет: in_progress > warning > overdue > ok.
    // planned_at често е само дата — сравняваме с днешната дата, не с
    // текущия момент, иначе днешен обход излиза „просрочен" още от сутринта.
    const today = todaySofia();

    const activeJobs = db
      .select({ property_id: jobs.property_id })
      .from(jobs)
      .where(eq(jobs.status, "in_progress"))
      .all();
    const activeSet = new Set(activeJobs.map((j) => j.property_id));

    const openFindings = db
      .select({ property_id: findings.property_id })
      .from(findings)
      .where(inArray(findings.status, ["open", "quote_requested", "quoted"]))
      .all();
    const warningSet = new Set(openFindings.map((f) => f.property_id));

    const overdueJobs = db
      .select({ property_id: jobs.property_id })
      .from(jobs)
      .where(and(eq(jobs.status, "planned"), lt(jobs.planned_at, today)))
      .all();
    const overdueSet = new Set(overdueJobs.map((j) => j.property_id));

    const withStatus = result.map((p) => ({
      ...p,
      // Одобрението (pending/active/rejected) е approval_status; `status`
      // остава оперативният статус, който картата и списъците ползват.
      approval_status: p.status,
      owner_name: person(p.owner_id)?.full_name || person(p.owner_id)?.email || null,
      // Имейл/телефон на собственика — само за админ (инспекторът има контакта за достъп).
      owner_email: session.role === "admin" ? person(p.owner_id)?.email ?? null : undefined,
      owner_phone: session.role === "admin" ? person(p.owner_id)?.phone ?? null : undefined,
      inspector_name: person(p.assigned_inspector_id)?.full_name ?? null,
      status: p.status === "pending"
        ? "pending"
        : p.status === "rejected"
          ? "rejected"
          : activeSet.has(p.id)
        ? "in_progress"
        : warningSet.has(p.id)
          ? "warning"
          : overdueSet.has(p.id)
            ? "overdue"
            : "ok",
    }));

    return NextResponse.json(withStatus);
  } catch (error) {
    console.error("GET /api/properties error:", error);
    return NextResponse.json({ error: "Грешка при зареждане" }, { status: 500 });
  }
});

export const POST = withAuth({ role: ["admin", "client"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { name, city, address, kind } = body;
    let { lat, lng } = body;
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

    if (!text(name) || !text(city) || !text(address)) {
      return NextResponse.json(
        { error: "Име, град и адрес са задължителни" },
        { status: 400 },
      );
    }

    // Админът добавя имот от името на клиент — собственикът трябва да е
    // клиент, иначе никой не може да реши по офертите за него.
    let ownerId = session.uid;
    if (session.role === "admin") {
      const owner = typeof body.owner_id === "string"
        ? db.select().from(users).where(eq(users.id, body.owner_id)).get()
        : undefined;
      if (!owner || owner.role !== "client") {
        return NextResponse.json({ error: "Изберете клиент-собственик" }, { status: 400 });
      }
      ownerId = owner.id;
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      const hit = await geocode(`${text(city)}, ${text(address)}`);
      if (!hit) {
        return NextResponse.json(
          { error: "Адресът не е намерен. Изберете го от предложенията." },
          { status: 400 },
        );
      }
      ({ lat, lng } = hit);
    }

    const isAdminCreate = session.role === "admin";
    const [property] = db
      .insert(properties)
      .values({
        name: text(name)!,
        city: text(city),
        address: text(address)!,
        lat,
        lng,
        kind: text(kind) || "apartment",
        access_notes: text(body.access_notes),
        contact_name: text(body.contact_name),
        contact_phone: text(body.contact_phone),
        owner_id: ownerId,
        org_id: session.org_id,
        // Имот, добавен от клиент, чака одобрение (въпрос 24) — там се
        // сверяват адресът и координатите. Админът одобрява, докато добавя.
        status: isAdminCreate ? "active" : "pending",
        approved_by: isAdminCreate ? session.uid : null,
        approved_at: isAdminCreate ? new Date().toISOString() : null,
      })
      .returning()
      .all();

    if (!isAdminCreate) {
      const owner = db.select({ name: users.full_name, email: users.email }).from(users).where(eq(users.id, property.owner_id)).get();
      await notify("property_new", {
        to: "admins",
        vars: { property: property.name, address: property.address ?? "", client: owner?.name ?? owner?.email ?? "" },
        rows: [["Контакт на място", [property.contact_name, property.contact_phone].filter(Boolean).join(", ")]],
      });
    }

    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    console.error("POST /api/properties error:", error);
    return NextResponse.json({ error: "Грешка при създаване" }, { status: 500 });
  }
});

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&accept-language=bg`,
      { headers: { "User-Agent": "KoManda/1.0 (comanda.bg)" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
