import type { Session } from "next-auth";

export function hasMetricsAccess(session: Session | null): boolean {
  if (!session?.user) {
    return false;
  }

  const permissions =
    (session.user as { permissions?: string[] }).permissions || [];
  return permissions.includes("metrics");
}

export function hasPermission(
  session: Session | null,
  permission: string
): boolean {
  if (!session?.user) {
    return false;
  }

  const permissions =
    (session.user as { permissions?: string[] }).permissions || [];
  return permissions.includes(permission);
}
