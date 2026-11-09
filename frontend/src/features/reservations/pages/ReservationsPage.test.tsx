import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "@/api/types";
import { AuthContext, type AuthContextValue } from "@/features/auth/AuthContext";
import type { Role, User } from "@/features/auth/types";

import { cancelReservation, listReservations } from "../api";
import type { Reservation } from "../types";
import { ReservationsPage } from "./ReservationsPage";

vi.mock("../api");

const member = { id: 7, email: "ana@example.com", full_name: "Ana Silva", member_number: "M-000007" };
const book = { id: 12, title: "Clean Architecture", isbn: "9780134494166", cover_image: null };

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 15,
    member,
    book,
    status: "PENDING",
    queue_position: 2,
    notified_at: null,
    expires_at: null,
    loan_id: null,
    created_at: "2026-11-04T05:20:00Z",
    ...overrides,
  };
}

function pageOf(results: Reservation[]): Paginated<Reservation> {
  return { count: results.length, page: 1, page_size: 20, total_pages: 1, next: null, previous: null, results };
}

function renderPage(role: Role = "MEMBER") {
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
  const auth: AuthContextValue = { status: "authenticated", user, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <ReservationsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listReservations).mockResolvedValue(
    pageOf([
      reservation(),
      reservation({
        id: 16,
        status: "READY",
        queue_position: null,
        expires_at: "2026-11-06T05:20:00Z",
        book: { ...book, id: 13, title: "The Pragmatic Programmer" },
      }),
    ]),
  );
});

describe("ReservationsPage", () => {
  it("asks only for open reservations by default and shows the queue place", async () => {
    renderPage();

    expect(await screen.findByText("Clean Architecture")).toBeInTheDocument();
    expect(screen.getByText("#2 in line")).toBeInTheDocument();
    expect(screen.getByText("Ready for pick-up")).toBeInTheDocument();
    expect(listReservations).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: true, page: 1 }),
      expect.anything(),
    );
  });

  it("members do not see the member column; staff do", async () => {
    const { unmount } = renderPage("MEMBER");
    await screen.findByText("Clean Architecture");
    expect(screen.queryByRole("columnheader", { name: "Member" })).not.toBeInTheDocument();
    unmount();

    renderPage("LIBRARIAN");
    await screen.findByText("Clean Architecture");
    expect(screen.getByRole("columnheader", { name: "Member" })).toBeInTheDocument();
    expect(screen.getAllByText("Ana Silva")).toHaveLength(2);
  });

  it("cancels a reservation", async () => {
    const user = userEvent.setup();
    vi.mocked(cancelReservation).mockResolvedValue(reservation({ status: "CANCELLED", queue_position: null }));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Cancel reservation of Clean Architecture" }));

    await waitFor(() => expect(cancelReservation).toHaveBeenCalledWith(15));
  });

  it("shows an empty state", async () => {
    vi.mocked(listReservations).mockResolvedValue(pageOf([]));
    renderPage();

    expect(await screen.findByText("No reservations to show.")).toBeInTheDocument();
  });
});
