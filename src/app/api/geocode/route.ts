import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { reverseAddress, searchAddress } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/**
 * GET /api/geocode?q=… — предложения за адрес, докато човекът пише.
 * GET /api/geocode?lat=…&lng=… — адресът на точка („Моето местоположение“).
 *
 * Връща СПИСЪК, не един резултат: човекът избира, вместо да гадае защо
 * адресът „не е намерен“. Само България — това е пазарът.
 */
export const GET = withAuth({}, async (request) => {
  const { searchParams } = new URL(request.url);

  if (searchParams.has("lat") && searchParams.has("lng")) {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ error: "Невалидни координати" }, { status: 400 });
    }
    const hit = await reverseAddress(lat, lng);
    if (!hit) return NextResponse.json({ error: "Не открихме адрес на това място. Напишете го." }, { status: 404 });
    return NextResponse.json({ results: [hit] });
  }

  const q = (searchParams.get("q") ?? "").trim().slice(0, 200);
  // Под 3 знака резултатите са безсмислени — не хабим заявка.
  if (q.length < 3) return NextResponse.json({ results: [] });

  const results = await searchAddress(q);
  if (!results) {
    return NextResponse.json({ error: "Търсенето на адреси е недостъпно в момента. Опитайте след малко." }, { status: 502 });
  }
  return NextResponse.json({ results });
});
