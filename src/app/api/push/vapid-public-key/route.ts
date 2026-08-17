import { NextResponse } from "next/server";
import { getVapidKeys } from "@/lib/push";

export const dynamic = "force-dynamic";

// @public VAPID публичният ключ е публичен по дефиниция — нужен е преди вход, за да се абонира браузърът.
export async function GET() {
  try {
    const { publicKey } = getVapidKeys();
    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error("GET /api/push/vapid-public-key error:", error);
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 }
    );
  }
}
