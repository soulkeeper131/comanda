import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./session";
import type { Role, SessionData } from "./session";

export type AuthedContext = {
  session: SessionData;
  params: Record<string, string>;
};

type RouteContext = { params?: Record<string, string> };

type Handler = (
  request: Request,
  ctx: AuthedContext,
) => Promise<Response> | Response;

export type AuthOptions = {
  /** Ако е зададено, сесията трябва да е с една от тези роли. */
  role?: Role[];
};

/**
 * Обвивка за route handler.
 *
 * Route без withAuth не получава `session` — значи не може да работи с
 * потребителски данни. Забравянето става счупен код, а не тиха дупка.
 */
export function withAuth(options: AuthOptions, handler: Handler) {
  return async function (
    request: Request,
    ctx: RouteContext = {},
  ): Promise<Response> {
    const raw = (await cookies()).get(SESSION_COOKIE)?.value;
    const session = raw ? verifySession(raw) : null;

    if (!session) {
      return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
    }

    if (options.role && !options.role.includes(session.role)) {
      return NextResponse.json(
        { error: "Нямате права за това действие" },
        { status: 403 },
      );
    }

    try {
      return await handler(request, { session, params: ctx.params ?? {} });
    } catch (error) {
      console.error("[withAuth] Необработена грешка:", error);
      return NextResponse.json({ error: "Възникна грешка" }, { status: 500 });
    }
  };
}
