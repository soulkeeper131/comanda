import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: "Параметър 'q' е задължителен" },
        { status: 400 },
      );
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q.trim())}&limit=1&accept-language=bg`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "KoManda/1.0",
      },
    });

    if (!response.ok) {
      console.error("Nominatim error:", response.status, await response.text());
      return NextResponse.json(
        { error: "Грешка при геокодиране" },
        { status: 502 },
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "Адресът не е намерен" },
        { status: 404 },
      );
    }

    const result = data[0];

    return NextResponse.json({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      display_name: result.display_name,
    });
  } catch (error) {
    console.error("GET /api/geocode error:", error);
    return NextResponse.json(
      { error: "Грешка при геокодиране" },
      { status: 500 },
    );
  }
}
