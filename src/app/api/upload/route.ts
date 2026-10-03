import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { saveImageUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload — снимка, която после се закача към доказателство,
 * констатация или оферта (claimUpload). Качват само инспектори и админ;
 * незакачените се трият след 7 дни.
 */
export const POST = withAuth({ role: ["admin", "inspector"] }, async (request, { session }) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Липсва файл" }, { status: 400 });
    }
    const saved = await saveImageUpload(file, session.uid);
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
    return NextResponse.json({ url: `/api/photos/${saved.filename}`, id: saved.filename });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: "Грешка при качване на файл" }, { status: 500 });
  }
});
