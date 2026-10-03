import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./session";
import type { Role, SessionData } from "./session";
import { currentUserState } from "./user-state";

export type AuthedContext = {
  session: SessionData;
  params: Record<string, string>;
};

// Next 15 подава параметрите на пътя като Promise.
type RouteContext = { params: Promise<Record<string, string>> };

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
    ctx: RouteContext,
  ): Promise<Response> {
    const raw = (await cookies()).get(SESSION_COOKIE)?.value;
    const token = raw ? verifySession(raw) : null;
    const state = token ? currentUserState(token.uid) : null;

    // Деактивиран профил или отменени сесии (нова парола, „изход от всички
    // устройства") — бисквитката вече не важи, макар да не е изтекла.
    if (!token || !state || !state.active || (token.sv ?? 0) !== state.sessionVersion) {
      return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
    }

    // Ролята идва от базата, не от бисквитката — смяната важи веднага.
    const session: SessionData = { ...token, role: state.role };

    if (options.role && !options.role.includes(session.role)) {
      return NextResponse.json(
        { error: "Нямате права за това действие" },
        { status: 403 },
      );
    }

    try {
      return await handler(request, { session, params: (await ctx?.params) ?? {} });
    } catch (error) {
      console.error("[withAuth] Необработена грешка:", error);
      return NextResponse.json({ error: "Възникна грешка" }, { status: 500 });
    }
  };
}
