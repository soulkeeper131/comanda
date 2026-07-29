import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API and static files
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next") || pathname.startsWith("/login") || pathname === "/" || /\.(html|css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot|pdf|json|xml|txt|map)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // Dashboard/etc protected — redirect to login
  const session = request.cookies.get("komanda_session");
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
