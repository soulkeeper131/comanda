import { db } from "@/db";
import { jobs, findings, offers, properties } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ZERO_STATS = {
  activeJobs: 0,
  plannedJobs: 0,
  completedJobs: 0,
  openFindings: 0,
  pendingOffers: 0,
  totalProperties: 0,
};

/**
 * Числата са скопирани по роля.
 *
 * Клиентът вижда САМО своите имоти и това, което се случва по тях. Преди тук
 * се връщаха глобални бройки, така че новорегистриран клиент без нито един
 * имот виждаше "5 имота" — чуждите. Бройка на чужди обекти е изтичане на
 * данни, дори когато самите записи не се показват.
 */
export const GET = withAuth({}, async (_request, { session }) => {
  try {
    const isClient = session.role === "client";

    // За клиент всичко се филтрира през неговите имоти.
    const ownedPropertyIds = isClient
      ? db
          .select({ id: properties.id })
          .from(properties)
          .where(
            and(eq(properties.owner_id, session.uid), eq(properties.archived, false)),
          )
          .all()
          .map((p) => p.id)
      : null;

    // Клиент без имоти няма какво да види — нулите са коректният отговор.
    if (ownedPropertyIds !== null && ownedPropertyIds.length === 0) {
      return NextResponse.json(ZERO_STATS);
    }

    const countJobs = (status: "planned" | "in_progress" | "completed") => {
      const scope =
        ownedPropertyIds === null
          ? eq(jobs.status, status)
          : and(eq(jobs.status, status), inArray(jobs.property_id, ownedPropertyIds))!;

      return (
        db
          .select({ count: sql<number>`count(*)` })
          .from(jobs)
          .where(scope)
          .get()?.count ?? 0
      );
    };

    const openFindings =
      db
        .select({ count: sql<number>`count(*)` })
        .from(findings)
        .where(
          ownedPropertyIds === null
            ? eq(findings.status, "open")
            : and(
                eq(findings.status, "open"),
                inArray(findings.property_id, ownedPropertyIds),
              ),
        )
        .get()?.count ?? 0;

    // Офертата сочи към констатация, а тя към имот — оттам идва обхватът.
    let pendingOffers = 0;
    if (ownedPropertyIds === null) {
      pendingOffers =
        db
          .select({ count: sql<number>`count(*)` })
          .from(offers)
          .where(eq(offers.decision, "pending"))
          .get()?.count ?? 0;
    } else {
      const ownedFindingIds = db
        .select({ id: findings.id })
        .from(findings)
        .where(inArray(findings.property_id, ownedPropertyIds))
        .all()
        .map((f) => f.id);

      pendingOffers =
        ownedFindingIds.length === 0
          ? 0
          : db
              .select({ count: sql<number>`count(*)` })
              .from(offers)
              .where(
                and(
                  eq(offers.decision, "pending"),
                  inArray(offers.finding_id, ownedFindingIds),
                ),
              )
              .get()?.count ?? 0;
    }

    const totalProperties =
      ownedPropertyIds === null
        ? db
            .select({ count: sql<number>`count(*)` })
            .from(properties)
            .where(eq(properties.archived, false))
            .get()?.count ?? 0
        : ownedPropertyIds.length;

    return NextResponse.json({
      activeJobs: countJobs("in_progress"),
      plannedJobs: countJobs("planned"),
      completedJobs: countJobs("completed"),
      openFindings,
      pendingOffers,
      totalProperties,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на статистика" }, { status: 500 });
  }
});
