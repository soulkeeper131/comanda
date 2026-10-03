import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { MESSAGES, effective, renderMessage, type MessageKey } from "@/lib/messages";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/messages — всички съобщения на системата в реда на
 * операцията: кой ги получава, кога, по кои канали, текстът сега и
 * този по подразбиране, променливите и готов преглед на имейла.
 */
export const GET = withAuth({ role: ["admin"] }, async () => {
  const list = (Object.keys(MESSAGES) as MessageKey[]).map((key) => {
    const def = MESSAGES[key];
    const m = effective(key);
    return {
      key,
      stage: def.stage,
      audience: def.audience,
      label: def.label,
      when: def.when,
      channels: m.channels,
      allowed: def.channels,
      subject: m.subject,
      title: m.title,
      body: m.body,
      defaults: { subject: def.subject ?? def.title, title: def.title, body: def.body },
      vars: def.vars,
      customized: m.customized,
      preview: renderMessage(key, def.sample, { rows: def.sampleRows }),
    };
  });
  return NextResponse.json(list);
});
