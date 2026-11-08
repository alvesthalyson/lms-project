import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

import { getActivity, getMostBorrowed, getSummary } from "../api";
import { DashboardPage } from "./DashboardPage";

vi.mock("../api");

const book = { id: 12, title: "Clean Architecture", isbn: "9780134494166", cover_image: null };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getSummary).mockResolvedValue({
    books: { titles: 40, copies_total: 100, copies_available: 87 },
    members: { total: 60, blocked: 3 },
    loans: { active: 13, overdue: 4 },
    reservations: { pending: 5, ready: 2 },
    fines: { unpaid_count: 6, unpaid_total: "63.50" },
  });
  vi.mocked(getMostBorrowed).mockResolvedValue([{ book, loan_count: 18 }]);
  vi.mocked(getActivity).mockResolvedValue({
    count: 1,
    page: 1,
    page_size: 10,
    total_pages: 1,
    next: null,
    previous: null,
    results: [
      {
        id: 1,
        action: "LOAN_RETURNED",
        action_label: "Loan returned",
        actor: null,
        member: { id: 7, email: "ana@example.com", full_name: "Ana Silva", member_number: "M-000007" },
        book,
        metadata: {},
        created_at: "2026-11-21T02:30:00Z",
      },
    ],
  });
});

describe("DashboardPage", () => {
  it("shows the headline numbers, the most borrowed titles and the activity feed", async () => {
    renderPage();

    expect(await screen.findByText("87 / 100")).toBeInTheDocument();
    expect(screen.getByText("63.50")).toBeInTheDocument();
    expect(screen.getByText("6 open")).toBeInTheDocument();
    expect(screen.getByText("2 ready for pick-up")).toBeInTheDocument();
    expect(await screen.findByText("18 loans")).toBeInTheDocument();
    expect(await screen.findByText("Loan returned")).toBeInTheDocument();
    expect(screen.getByText("Ana Silva · Clean Architecture")).toBeInTheDocument();
  });

  it("shows the API's error and a retry button when the summary fails", async () => {
    vi.mocked(getSummary).mockRejectedValueOnce(
      new ApiError({ status: 403, code: "permission_denied", detail: "Only librarians can do this." }),
    );
    renderPage();

    expect(await screen.findByText("Only librarians can do this.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("says so when nothing has been borrowed yet", async () => {
    vi.mocked(getMostBorrowed).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("No loans in this period.")).toBeInTheDocument();
  });
});
