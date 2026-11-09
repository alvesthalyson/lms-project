import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, type Location } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "../AuthContext";
import { STAFF_ROLES } from "../access";
import type { Role, User } from "../types";
import { ProtectedRoute } from "./ProtectedRoute";

function makeUser(role: Role): User {
  return {
    id: 1,
    email: "user@example.com",
    first_name: "Test",
    last_name: "User",
    role,
    member_number: role === "MEMBER" ? "M-000001" : null,
    phone: "",
    address: "",
    is_active: true,
    is_blocked: false,
    blocked_reason: "",
    blocked_at: null,
    date_joined: "2026-11-01T00:00:00Z",
  };
}

/** Where the redirect landed, and which page the user was trying to reach. */
function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from?.pathname;
  return <p>Login page (came from {from ?? "nowhere"})</p>;
}

function renderAt(path: string, auth: Pick<AuthContextValue, "status" | "user">) {
  const value: AuthContextValue = { ...auth, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/loans" element={<p>Loans page</p>} />
          </Route>
          <Route element={<ProtectedRoute roles={STAFF_ROLES} />}>
            <Route path="/staff" element={<p>Staff area</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("sends an anonymous visitor to the login page and remembers where they were going", () => {
    renderAt("/loans", { status: "anonymous", user: null });

    expect(screen.getByText("Login page (came from /loans)")).toBeInTheDocument();
    expect(screen.queryByText("Loans page")).not.toBeInTheDocument();
  });

  it("waits while the session is being restored instead of flashing the login page", () => {
    renderAt("/loans", { status: "loading", user: null });

    expect(screen.getByText("Restoring your session…")).toBeInTheDocument();
    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument();
    expect(screen.queryByText("Loans page")).not.toBeInTheDocument();
  });

  it("lets any signed-in user through a route with no role requirement", () => {
    renderAt("/loans", { status: "authenticated", user: makeUser("MEMBER") });

    expect(screen.getByText("Loans page")).toBeInTheDocument();
  });

  it("shows an access-denied screen to a member on a staff route (not the login page)", () => {
    renderAt("/staff", { status: "authenticated", user: makeUser("MEMBER") });

    expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("Staff area")).not.toBeInTheDocument();
  });

  it.each<Role>(["LIBRARIAN", "ADMIN"])("lets a %s into the staff area (admin is a superset)", (role) => {
    renderAt("/staff", { status: "authenticated", user: makeUser(role) });

    expect(screen.getByText("Staff area")).toBeInTheDocument();
  });
});
