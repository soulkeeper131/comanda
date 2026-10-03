import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { MESSAGES, effective, renderMessage, saveOverride, type MessageKey } from "@/lib/messages";

export const dynamic = "force-dynamic";

const isKey = (k: string): k is MessageKey => Object.prototype.hasOwnProperty.call(MESSAGES, k);

/**
 * PUT /api/admin/messages/[key] { subject?, title?, body?, app?, email? }
 * — нов текст / канали. Празно поле = текстът по подразбиране.
 * DELETE — връща всичко по подразбиране.
 */
export const PUT = withAuth({ role: ["admin"] }, async (request, { params }) => {
  if (!isKey(params.key)) return NextResponse.json({ error: "Няма такова съобщение" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const def = MESSAGES[params.key];
  // Неизвестни {{променливи}} се показват като празно — предупреждаваме веднага.
  const known = new Set(Object.keys(def.vars));
  const unknown = (["subject", "title", "body"] as const)
    .flatMap((f) => (typeof body[f] === "string" ? Array.from(body[f].matchAll(/\{\{\s*(\w+)\s*\}\}/g), (m) => m[1]) : []))
    .filter((v) => !known.has(v));
  if (unknown.length) {
    return NextResponse.json({ error: `Непозната променлива: {{${unknown[0]}}}. Позволени: ${[...known].map((v) => `{{${v}}}`).join(", ")}` }, { status: 400 });
  }
  const pick = (f: "subject" | "title" | "body") => {
    const v = typeof body[f] === "string" ? body[f].trim() : "";
    const d = f === "subject" ? def.subject ?? def.title : def[f];
    return v && v !== d ? v : undefined;
  };
  saveOverride(params.key, {
    subject: pick("subject"),
    title: pick("title"),
    body: pick("body"),
    app: typeof body.app === "boolean" && def.channels.app ? body.app : undefined,
    email: typeof body.email === "boolean" && def.channels.email ? body.email : undefined,
  });
  const m = effective(params.key);
  return NextResponse.json({ ...m, preview: renderMessage(params.key, def.sample, { rows: def.sampleRows }) });
});

export const DELETE = withAuth({ role: ["admin"] }, async (_request, { params }) => {
  if (!isKey(params.key)) return NextResponse.json({ error: "Няма такова съобщение" }, { status: 404 });
  saveOverride(params.key, null);
  return NextResponse.json({ success: true });
});
