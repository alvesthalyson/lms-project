import type { ReactNode } from "react";

import { useHasRole } from "../hooks";
import type { Role } from "../types";

/**
 * Show `children` only to the given roles (ADMIN also satisfies LIBRARIAN).
 * This only hides UI; the API enforces permissions regardless.
 *
 *   <RoleGate roles={STAFF_ROLES}><Button>Add book</Button></RoleGate>
 */
export function RoleGate({
  roles,
  children,
  fallback = null,
}: {
  roles: readonly Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{useHasRole(roles) ? children : fallback}</>;
}
