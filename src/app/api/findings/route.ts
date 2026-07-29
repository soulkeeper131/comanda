import { NextResponse } from "next/server";
import { MOCK_FINDINGS } from "@/lib/mock-findings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(MOCK_FINDINGS);
  } catch (error) {
    console.error("GET /api/findings error:", error);
    return NextResponse.json({ error: "Грешка при зареждане" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, title, body: desc, propertyId, jobId } = body;

    if (!type || !title || !propertyId) {
      return NextResponse.json(
        { error: "Тип, заглавие и имот са задължителни" },
        { status: 400 }
      );
    }

    const finding = {
      id: `f${Date.now()}`,
      propertyId,
      propertyName: propertyId,
      jobId: jobId || null,
      type,
      title,
      body: desc || "",
      status: "open" as const,
      createdAt: new Date().toISOString(),
      photos: [],
      offer: null,
    };

    // In a real app we'd insert into DB here
    MOCK_FINDINGS.unshift(finding);

    return NextResponse.json(finding, { status: 201 });
  } catch (error) {
    console.error("POST /api/findings error:", error);
    return NextResponse.json({ error: "Грешка при създаване" }, { status: 500 });
  }
}
