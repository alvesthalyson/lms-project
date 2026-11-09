import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

import { AuthContext, type AuthContextValue } from "../AuthContext";
import type { User } from "../types";
import { RegisterPage } from "./RegisterPage";

const NEW_MEMBER: User = {
  id: 7,
  email: "ana@example.com",
  first_name: "Ana",
  last_name: "Silva",
  role: "MEMBER",
  member_number: "M-000007",
  phone: "",
  address: "",
  is_active: true,
  is_blocked: false,
  blocked_reason: "",
  blocked_at: null,
  date_joined: "2026-11-09T00:00:00Z",
};

function renderPage(register: AuthContextValue["register"]) {
  const auth: AuthContextValue = { status: "anonymous", user: null, login: vi.fn(), register, logout: vi.fn() };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[{ pathname: "/register", state: { from: { pathname: "/" } } }]}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<p>Home page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>, overrides: Record<string, string> = {}) {
  const values = {
    "First name": "Ana",
    "Last name": "Silva",
    Email: "ana@example.com",
    Password: "S3cure-passphrase",
    "Confirm password": "S3cure-passphrase",
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    await user.type(screen.getByLabelText(label), value);
  }
}

describe("RegisterPage", () => {
  it("creates the account and returns to where the visitor came from", async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockResolvedValue(NEW_MEMBER);
    renderPage(register);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      first_name: "Ana",
      last_name: "Silva",
      email: "ana@example.com",
      password: "S3cure-passphrase",
    });
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("does not call the API when the passwords differ", async () => {
    const user = userEvent.setup();
    const register = vi.fn();
    renderPage(register);

    await fill(user, { "Confirm password": "something-else" });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("The passwords do not match")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows the server's message on the email field when it is already taken", async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockRejectedValue(
      new ApiError({
        status: 400,
        code: "validation_error",
        detail: "Invalid input.",
        fieldErrors: { email: ["A user with this email already exists."] },
      }),
    );
    renderPage(register);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("A user with this email already exists.")).toBeInTheDocument();
  });
});
