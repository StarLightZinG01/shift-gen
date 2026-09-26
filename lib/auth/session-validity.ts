export function isSessionCurrent(
  session: { sessionVersion: number },
  user: { status: string; sessionVersion: number } | null,
) {
  return (
    user !== null &&
    user.status === "active" &&
    user.sessionVersion === session.sessionVersion
  );
}

export function getAdminSessionAccess(
  session: { roles: string[] } | null,
): "allow" | "session-expired" | "forbidden" {
  if (!session) {
    return "session-expired";
  }

  return session.roles.includes("admin") ? "allow" : "forbidden";
}
