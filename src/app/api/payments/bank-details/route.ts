import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getBankDetails } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /api/payments/bank-details — IBAN и получател за плащане по банка. */
export const GET = withAuth({}, async () => NextResponse.json(getBankDetails()));
