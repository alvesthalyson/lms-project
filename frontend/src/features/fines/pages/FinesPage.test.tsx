import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "@/api/types";
import { AuthContext, type AuthContextValue } from "@/features/auth/AuthContext";
import type { Role, User } from "@/features/auth/types";
import type { Fine } from "@/features/loans/types";

import { listFines, payFine } from "../api";
import { FinesPage } from "./FinesPage";

vi.mock("../api");

const fine: Fine = {
  id: 9,
  loan_id: 42,
  member: { id: 7, email: "ana@example.com", full_name: "Ana Silva", member_number: "M-000007" },
  book: { id: 12, title: "Clean Architecture", isbn: "9780134494166", cover_image: null },
  reason: "OVERDUE",
  amount: "1.50",
  status: "UNPAID",
  paid_at: null,
  note: "",
  created_at: "2026-11-21T02:30:00Z",
};

function renderPage(role: Role) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
    id: 1,
    email: "u@example.com",
    first_name: "U",
    last_name: "Ser",
    role,
    member_number: null,
    phone: "",
    address: "",
    is_active: true,
    is_blocked: false,
    blocked_reason: "",
    blocked_at: null,
    date_joined: "2026-11-01T00:00:00Z",
  } satisfies User;
  const auth: AuthContextValue = { status: "authenticated", user, login: vi.fn(), logout: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <FinesPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  const page: Paginated<Fine> = {
    count: 1,
    page: 1,
    page_size: 20,
    total_pages: 1,
    next: null,
    previous: null,
    results: [fine],
  };
  vi.mocked(listFines).mockResolvedValue(page);
});

describe("FinesPage", () => {
  it("members see their fines but have no actions", async () => {
    renderPage("MEMBER");

    expect(await screen.findByText("Clean Architecture")).toBeInTheDocument();
    expect(screen.getByText("1.50")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark fine/ })).not.toBeInTheDocument();
  });

  it("a librarian can mark a fine paid but not waive it", async () => {
    const user = userEvent.setup();
    vi.mocked(payFine).mockResolvedValue({ ...fine, status: "PAID", paid_at: "2026-11-22T00:00:00Z" });
    renderPage("LIBRARIAN");

    expect(screen.queryByRole("button", { name: "Waive fine 9" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Mark fine 9 as paid" }));

    await waitFor(() => expect(payFine).toHaveBeenCalledWith(9));
  });

  it("an admin also gets the waive button", async () => {
    renderPage("ADMIN");

    expect(await screen.findByRole("button", { name: "Waive fine 9" })).toBeInTheDocument();
  });
});
