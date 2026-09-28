import { db } from "@/db";
import { findings, findingPhotos, properties, users, jobItems, jobs, offers } from "@/db/schema";
import { eq, desc, inArray, and, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail, ownerEmailFor } from "@/lib/email";
import { notifyOwner, notifyAdmins } from "@/lib/notifications";
import { withAuth, canCompleteJobItem } from "@/lib/auth";
import { emailLayout } from "@/lib/mail-layout";
import { uploadedFileExists, uploadFilename } from "@/lib/uploads";
import { isFindingStatus, isSeverity, sortFindings } from "@/lib/domain/findings";

export const dynamic = "force-dynamic";

function photoView(p: { id: string; storage_path: string; taken_at: string | null }) {
  const name = uploadFilename(p.storage_path);
  return { id: p.id, storage_path: p.storage_path, url: `/api/photos/${name}`, taken_at: p.taken_at };
}

// GET /api/findings?status=open&property_id=X
export const GET = withAuth({}, async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const propertyIdFilter = searchParams.get("property_id");

    const conditions: SQL[] = [];
    if (statusFilter && isFindingStatus(statusFilter)) conditions.push(eq(findings.status, statusFilter));
    if (propertyIdFilter) conditions.push(eq(findings.property_id, propertyIdFilter));
    // Клиентът вижда само констатациите по своите имоти
    if (session.role === "client") conditions.push(eq(properties.owner_id, session.uid));

    const rows = db
      .select({
        id: findings.id,
        org_id: findings.org_id,
        property_id: findings.property_id,
        job_id: findings.job_id,
        job_item_id: findings.job_item_id,
        reported_by: findings.reported_by,
        title: findings.title,
        body: findings.body,
        severity: findings.severity,
        status: findings.status,
        quote_requested_at: findings.quote_requested_at,
        created_at: findings.created_at,
        property_name: properties.name,
        reporter_name: users.full_name,
      })
      .from(findings)
      .innerJoin(properties, eq(findings.property_id, properties.id))
      .leftJoin(users, eq(findings.reported_by, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(findings.created_at))
      .all();

    if (rows.length === 0) return NextResponse.json([]);

    const ids = rows.map((r) => r.id);
    const allPhotos = db.select().from(findingPhotos).where(inArray(findingPhotos.finding_id, ids)).all();
    const itemIds = rows.map((r) => r.job_item_id).filter((x): x is string => !!x);
    const items = itemIds.length
      ? db
          .select({ id: jobItems.id, label: jobItems.label, zone_label: jobItems.zone_label })
          .from(jobItems)
          .where(inArray(jobItems.id, itemIds))
          .all()
      : [];
    const allOffers = db
      .select({
        id: offers.id,
        finding_id: offers.finding_id,
        decision: offers.decision,
        price: offers.price,
        days: offers.days,
        scope: offers.scope,
        sent_at: offers.sent_at,
        expires_at: offers.expires_at,
      })
      .from(offers)
      .where(inArray(offers.finding_id, ids))
      .all();

    const result = rows.map((row) => {
      const own = allOffers
        .filter((o) => o.finding_id === row.id)
        .sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));
      return {
        ...row,
        photos: allPhotos.filter((p) => p.finding_id === row.id).map(photoView),
        job_item: row.job_item_id ? items.find((i) => i.id === row.job_item_id) ?? null : null,
        // Последната оферта — клиентският екран показва нея, не историята.
        offer: own[0] ?? null,
      };
    });

    return NextResponse.json(sortFindings(result));
  } catch (error) {
    console.error("GET /api/findings error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на констатации" }, { status: 500 });
  }
});

// POST /api/findings — инспектор/админ докладва проблем
export const POST = withAuth({ role: ["admin", "inspector"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { job_id, job_item_id, title, photo_ids } = body;
    const desc: string = typeof body.body === "string" ? body.body.trim() : "";
    const severity = isSeverity(body.severity) ? body.severity : "normal";
    let propertyId: string | undefined = body.property_id;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Заглавието е задължително" }, { status: 400 });
    }

    // От обход — имотът идва от обхода, не от клиента на заявката.
    if (job_id) {
      const job = db.select().from(jobs).where(eq(jobs.id, job_id)).get();
      if (!job || !canCompleteJobItem(session, job)) {
        return NextResponse.json({ error: "Обходът не е намерен" }, { status: 404 });
      }
      propertyId = job.property_id;
      if (job_item_id) {
        const item = db.select().from(jobItems).where(eq(jobItems.id, job_item_id)).get();
        if (!item || item.job_id !== job.id) {
          return NextResponse.json({ error: "Стъпката не е от този обход" }, { status: 400 });
        }
      }
    }

    const property = propertyId
      ? db.select().from(properties).where(eq(properties.id, propertyId)).get()
      : undefined;
    if (!property) {
      return NextResponse.json({ error: "Изберете имот" }, { status: 400 });
    }

    const photos: string[] = Array.isArray(photo_ids)
      ? photo_ids.filter((p: unknown): p is string => typeof p === "string" && uploadedFileExists(p))
      : [];

    const [finding] = db
      .insert(findings)
      .values({
        org_id: property.org_id,
        property_id: property.id,
        job_id: job_id || null,
        job_item_id: job_item_id || null,
        reported_by: session.uid,
        title: title.trim(),
        body: desc,
        severity,
        status: "open",
      })
      .returning()
      .all();

    for (const p of photos) {
      db.insert(findingPhotos).values({ finding_id: finding.id, storage_path: uploadFilename(p) }).run();
    }

    const urgent = severity === "urgent";
    const subject = urgent
      ? `СПЕШНО: ${title.trim()} — ${property.name}`
      : `Нова констатация в ${property.name}: ${title.trim()}`;
    const html = emailLayout({
      title: urgent ? "Спешна констатация" : "Нова констатация",
      intro: urgent
        ? "Инспекторът отбеляза проблем, който не бива да чака. Екипът ни вече е уведомен."
        : undefined,
      color: urgent ? "#dc2626" : "#006494",
      rows: [
        ["Имот", property.name],
        ["Проблем", title.trim()],
        ["Описание", desc],
      ],
      cta: { label: urgent ? "Виж и реши" : "Виж в приложението" },
    });

    sendEmail({ to: (await getNotifyEmail()) || "", subject, html }).catch(() => {});

    // Спешна — веднага до собственика и всички админи (въпрос 17): in-app,
    // push и имейл. Нормалната стига до клиента в приложението.
    if (urgent) {
      const ownerEmail = ownerEmailFor(property.id);
      if (ownerEmail) sendEmail({ to: ownerEmail, subject, html }).catch(() => {});
      notifyAdmins("finding_urgent", "Спешна констатация", `${title.trim()} — ${property.name}`, "/dashboard");
      notifyOwner(property.id, "finding_urgent", "Спешен проблем в имота", title.trim(), "/dashboard");
    } else {
      notifyOwner(property.id, "finding_new", "Нова констатация", title.trim(), "/dashboard");
    }

    const savedPhotos = db.select().from(findingPhotos).where(eq(findingPhotos.finding_id, finding.id)).all();
    return NextResponse.json(
      { ...finding, property_name: property.name, photos: savedPhotos.map(photoView), offer: null },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/findings error:", error);
    return NextResponse.json({ error: "Грешка при създаване на констатация" }, { status: 500 });
  }
});
