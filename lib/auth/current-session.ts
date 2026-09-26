import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type SessionPayload,
} from "./session";
import {
  getAdminSessionAccess,
  isSessionCurrent,
} from "./session-validity";

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const session = await verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { status: true, sessionVersion: true },
    });

    if (!isSessionCurrent(session, user)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await getCurrentSession();
  const access = getAdminSessionAccess(session);

  if (!session) {
    redirect("/auth/session-expired");
  }

  if (access === "forbidden") {
    redirect("/home");
  }

  return session;
}
