import { useContext } from "react";

import { hasAnyRole } from "./access";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import type { Role } from "./types";

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** True if the signed-in user holds one of the roles (ADMIN also satisfies LIBRARIAN). */
export function useHasRole(roles: readonly Role[]): boolean {
  return hasAnyRole(useAuth().user, roles);
}
