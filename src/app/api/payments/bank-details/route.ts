import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getBankDetails } from "@/lib/settings";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/bank-details — IBAN и получател за плащане по банка,
 * и дали плащането с карта е настроено (за избора в екраните).
 */
export const GET = withAuth({}, async () => NextResponse.json({ ...getBankDetails(), card_enabled: isStripeConfigured() }));
