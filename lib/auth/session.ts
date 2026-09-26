import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "shiftgen_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 6;

export type SessionPayload = {
  userId: string;
  username: string;
  displayName: string;
  employeeCode: string | null;
  roles: string[];
  staffId: string | null;
  homeWardId: string | null;
  homeWardCode: string | null;
  isHead: boolean;
  sessionVersion: number;
};

type JwtSessionPayload = SessionPayload & {
  exp?: number;
  iat?: number;
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getAuthSecret());

  return {
    userId: requireString(payload.userId, "userId"),
    username: requireString(payload.username, "username"),
    displayName: requireString(payload.displayName, "displayName"),
    employeeCode: nullableString(payload.employeeCode),
    roles: Array.isArray(payload.roles)
      ? payload.roles.filter((role): role is string => typeof role === "string")
      : [],
    staffId: nullableString(payload.staffId),
    homeWardId: nullableString(payload.homeWardId),
    homeWardCode: nullableString(payload.homeWardCode),
    isHead: payload.isHead === true,
    sessionVersion: requireNumber(payload.sessionVersion, "sessionVersion"),
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
    iat: typeof payload.iat === "number" ? payload.iat : undefined,
  } satisfies JwtSessionPayload;
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters long.");
  }

  return new TextEncoder().encode(secret);
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid session token: missing ${fieldName}.`);
  }

  return value;
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function requireNumber(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid session token: missing ${fieldName}.`);
  }

  return value;
}
