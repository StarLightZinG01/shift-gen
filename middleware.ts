import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session";
import { canAccessPath } from "@/lib/app-navigation";

const HOME_PATH = "/home";
const PROTECTED_PATH_PREFIXES = [HOME_PATH, "/admin", "/schedule-rounds"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await getSessionFromRequest(request);
  const isProtectedPath = PROTECTED_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isProtectedPath && !session) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
        { status: 401 },
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  if (pathname === "/" && session) {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
  }

  if (session && isProtectedPath && !canAccessPath(session.roles, pathname)) {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
