import { db } from "@/db";
import { properties, users, plans } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, canViewProperty, isAdmin } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { emailLayout } from "@/lib/mail-layout";
import { normalizeOverrideReason } from "@/lib/domain/overrides";

export const dynamic = "force-dynamic";

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// GET /api/properties/[id]
export const GET = withAuth({}, async (_request, { session, params }) => {
  const property = db.select().from(properties).where(eq(properties.id, params.id)).get();
  if (!property || !canViewProperty(session, property)) {
    return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
  }
  return NextResponse.json(property);
});

/**
 * PATCH /api/properties/[id]
 *
 * Клиентът коригира своя имот, докато чака одобрение (после адресът е
 * сверен и само админ го мени). Контактът и бележките за достъп се
 * поддържат от клиента винаги — те се менят в живота.
 *
 * Админът: всичко, плюс одобрение (`status: "active"`), отказ
 * (`status: "rejected"` + `rejection_reason`) и инспектор на имота.
 */
export const PATCH = withAuth({ role: ["admin", "client"] }, async (request, { session, params }) => {
  try {
    const property = db.select().from(properties).where(eq(properties.id, params.id)).get();
    if (!property || !canViewProperty(session, property)) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }
    const admin = isAdmin(session);
    const body = await request.json();
    const updates: Partial<typeof properties.$inferInsert> = {};

    // Винаги редактируеми от собственика
    for (const key of ["contact_name", "contact_phone", "access_notes"] as const) {
      if (body[key] !== undefined) updates[key] = text(body[key]);
    }

    // Адрес и име — клиентът само докато имотът чака одобрение
    const addressKeys = ["name", "city", "address", "kind"] as const;
    const touchesAddress = addressKeys.some((k) => body[k] !== undefined) || body.lat !== undefined || body.lng !== undefined;
    if (touchesAddress) {
      if (!admin && property.status !== "pending") {
        return NextResponse.json(
          { error: "Адресът на одобрен имот се сменя от администратор" },
          { status: 403 },
        );
      }
      for (const key of addressKeys) {
        if (body[key] !== undefined) {
          const v = text(body[key]);
          if (!v && key !== "city") return NextResponse.json({ error: "Полето е задължително" }, { status: 400 });
          updates[key] = v ?? undefined;
        }
      }
      if (body.lat !== undefined || body.lng !== undefined) {
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          return NextResponse.json({ error: "Невалидни координати" }, { status: 400 });
        }
        updates.lat = lat;
        updates.lng = lng;
      }
    }

    let decided: "active" | "rejected" | null = null;
    if (admin) {
      if (body.geofence_m !== undefined) {
        const g = parseInt(body.geofence_m, 10);
        if (!Number.isFinite(g) || g < 0 || g > 5000) {
          return NextResponse.json({ error: "Периметърът е между 0 и 5000 м" }, { status: 400 });
        }
        updates.geofence_m = g;
      }

      if (body.assigned_inspector_id !== undefined) {
        if (body.assigned_inspector_id === null || body.assigned_inspector_id === "") {
          updates.assigned_inspector_id = null;
        } else {
          const insp = db.select().from(users).where(eq(users.id, body.assigned_inspector_id)).get();
          if (!insp || insp.role !== "inspector" || insp.active === false) {
            return NextResponse.json({ error: "Изберете активен инспектор" }, { status: 400 });
          }
          // Смяната важи за новите обходи — създадените не се пренаписват (въпрос 10).
          updates.assigned_inspector_id = insp.id;
        }
      }

      if (body.owner_id !== undefined) {
        const owner = db.select().from(users).where(eq(users.id, body.owner_id)).get();
        if (!owner || owner.role !== "client") {
          return NextResponse.json({ error: "Собственикът трябва да е клиент" }, { status: 400 });
        }
        updates.owner_id = owner.id;
      }

      if (body.status !== undefined) {
        if (body.status === "active") {
          updates.status = "active";
          updates.rejection_reason = null;
          updates.approved_by = session.uid;
          updates.approved_at = new Date().toISOString();
          decided = "active";
        } else if (body.status === "rejected") {
          let reason: string;
          try {
            reason = normalizeOverrideReason(typeof body.rejection_reason === "string" ? body.rejection_reason : "");
          } catch {
            return NextResponse.json({ error: "Посочете причина за отказа (поне 5 знака)" }, { status: 400 });
          }
          updates.status = "rejected";
          updates.rejection_reason = reason;
          decided = "rejected";
        } else if (body.status === "pending") {
          updates.status = "pending";
        } else {
          return NextResponse.json({ error: "Невалиден статус" }, { status: 400 });
        }
      }

      if (body.archived === true) {
        const live = db
          .select({ id: plans.id })
          .from(plans)
          .where(and(eq(plans.property_id, property.id), inArray(plans.status, ["requested", "active"])))
          .get();
        if (live) {
          return NextResponse.json({ error: "Имотът има активен абонамент — първо го откажете" }, { status: 409 });
        }
        updates.archived = true;
      }
    } else {
      const adminOnly = ["status", "assigned_inspector_id", "geofence_m", "owner_id", "archived"];
      if (adminOnly.some((k) => body[k] !== undefined)) {
        return NextResponse.json({ error: "Само администратор може да прави тази промяна" }, { status: 403 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Няма полета за обновяване" }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const [updated] = db.update(properties).set(updates).where(eq(properties.id, property.id)).returning().all();

    if (decided && decided !== property.status) {
      const approved = decided === "active";
      createNotification(
        property.owner_id,
        "property_decided",
        approved ? "Имотът е одобрен" : "Имотът не е одобрен",
        approved ? `${updated.name} — вече можете да изберете пакет.` : updated.rejection_reason ?? undefined,
        "/dashboard",
      );
      const owner = db.select({ email: users.email }).from(users).where(eq(users.id, property.owner_id)).get();
      if (owner?.email) {
        sendEmail({
          to: owner.email,
          subject: approved ? `Имотът ${updated.name} е одобрен` : `Имотът ${updated.name} не е одобрен`,
          html: emailLayout({
            title: approved ? "Имотът е одобрен" : "Имотът не е одобрен",
            intro: approved
              ? "Адресът е проверен. Следващата стъпка е да изберете пакет за обслужване."
              : "За съжаление не можем да обслужваме този имот.",
            rows: [
              ["Имот", updated.name],
              ["Адрес", updated.address],
              ["Причина", approved ? null : updated.rejection_reason],
            ],
            color: approved ? "#16a34a" : "#dc2626",
            cta: approved ? { label: "Избери пакет" } : undefined,
          }),
        }).catch(() => {});
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/properties/[id] error:", error);
    return NextResponse.json({ error: "Грешка при обновяване на имота" }, { status: 500 });
  }
});
