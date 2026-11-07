import type { AuthStatus, Role, User } from "./types";

/** LIBRARIAN or ADMIN: everyone who manages the catalogue and loans. */
export const STAFF_ROLES: readonly Role[] = ["LIBRARIAN", "ADMIN"];

type WithRole = Pick<User, "role">;

/**
 * True if the user holds one of `allowed`. ADMIN is a superset of LIBRARIAN
 * (same rule as the backend's IsLibrarian permission), so an admin passes
 * anything that a librarian may do.
 */
export function hasAnyRole(user: WithRole | null | undefined, allowed: readonly Role[]): boolean {
  if (!user) return false;
  if (allowed.includes(user.role)) return true;
  return user.role === "ADMIN" && allowed.includes("LIBRARIAN");
}

export function isStaff(user: WithRole | null | undefined): boolean {
  return hasAnyRole(user, STAFF_ROLES);
}

export type AccessDecision =
  | { type: "loading" }
  | { type: "login" }
  | { type: "forbidden" }
  | { type: "allow" };

/** Pure decision behind ProtectedRoute, so the rules are testable without a router. */
export function decideAccess(input: {
  status: AuthStatus;
  user: WithRole | null;
  allowedRoles?: readonly Role[];
}): AccessDecision {
  if (input.status === "loading") return { type: "loading" };
  if (input.status === "anonymous" || !input.user) return { type: "login" };
  if (input.allowedRoles && !hasAnyRole(input.user, input.allowedRoles)) return { type: "forbidden" };
  return { type: "allow" };
}
