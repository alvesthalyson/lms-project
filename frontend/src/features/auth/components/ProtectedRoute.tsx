import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Spinner } from "@/components/Spinner";

import { decideAccess } from "../access";
import { useAuth } from "../hooks";
import type { Role } from "../types";

/**
 * Layout route that guards its children:
 *  - session still being restored: spinner (never flash the login page)
 *  - not signed in: redirect to /login, remembering where the user was going
 *  - signed in without a required role: 403 screen
 *
 *   { element: <ProtectedRoute />, children: [...] }
 *   { element: <ProtectedRoute roles={STAFF_ROLES} />, children: [...] }
 */
export function ProtectedRoute({ roles }: { roles?: readonly Role[] }) {
  const { status, user } = useAuth();
  const location = useLocation();
  const decision = decideAccess({ status, user, allowedRoles: roles });

  switch (decision.type) {
    case "loading":
      return <Spinner label="Restoring your session…" />;
    case "login":
      return <Navigate to="/login" replace state={{ from: location }} />;
    case "forbidden":
      return (
        <div role="alert" className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="mt-2 text-muted-foreground">Your account does not have permission to view this page.</p>
        </div>
      );
    case "allow":
      return <Outlet />;
  }
}
