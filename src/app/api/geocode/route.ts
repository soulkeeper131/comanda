import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  address?: Record<string, string>;
};

/** Кратко име за списъка с предложения — пълното display_name е неизползваемо. */
function shortLabel(hit: NominatimHit): string {
  const a = hit.address ?? {};
  const street = [a.road, a.house_number].filter(Boolean).join(" ");
  const place = a.city || a.town || a.village || a.municipality || "";
  const area = a.suburb || a.neighbourhood || a.city_district || "";

  const parts = [street || a.amenity || a.building, area, place].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : hit.display_name.split(",").slice(0, 3).join(",");
}

/**
 * Търсене на адрес с предложения.
 *
 * Връща СПИСЪК, не един резултат. Преди тук стоеше limit=1: потребителят
 * пишеше адрес и или уцелваше точно, или получаваше "не е намерен", без да
 * разбира защо. Списъкът позволява избор — както работи всяко търсене на
 * адрес, с което хората са свикнали.
 *
 * Търсенето е ограничено до България (countrycodes=bg), защото това е пазарът.
 */
export const GET = withAuth({}, async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();

    // Под 3 знака резултатите са безсмислени — не хабим заявка към Nominatim.
    if (q.length < 3) {
      return NextResponse.json({ results: [] });
    }

    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2` +
      `&q=${encodeURIComponent(q)}` +
      `&limit=6&addressdetails=1&countrycodes=bg&accept-language=bg`;

    const response = await fetch(url, {
      headers: { "User-Agent": "KoManda/1.0 (comanda.blv.bg)" },
      // Nominatim иска да не го заливаме; кешираме за минута.
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      console.error("Nominatim error:", response.status);
      return NextResponse.json(
        { error: "Търсенето на адреси е недостъпно в момента." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as NominatimHit[];

    if (!Array.isArray(data)) {
      return NextResponse.json({ results: [] });
    }

    const results = data.map((hit) => ({
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      label: shortLabel(hit),
      display_name: hit.display_name,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("GET /api/geocode error:", error);
    return NextResponse.json(
      { error: "Грешка при търсене на адрес" },
      { status: 500 },
    );
  }
});
