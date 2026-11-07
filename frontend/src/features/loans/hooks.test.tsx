import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { bookKeys } from "@/features/books/hooks";
import { reservationKeys } from "@/features/reservations/hooks";
import { createQueryClient } from "@/lib/query-client";
import { useToastStore } from "@/lib/toast";

import { createLoan, returnLoan } from "./api";
import { loanKeys, useCreateLoan, useReturnLoan } from "./hooks";
import type { Fine, Loan, ReturnLoanResponse } from "./types";

// The HTTP layer is the mock boundary: the hook's own logic (cache invalidation, error toasts) is what runs.
vi.mock("./api");

const loan = { id: 42, status: "active" } as Loan;
const fine: Fine = {
  id: 9,
  loan_id: 42,
  reason: "OVERDUE",
  amount: "1.50",
  status: "UNPAID",
  paid_at: null,
  note: "3 days overdue at 0.50/day",
  created_at: "2026-11-21T02:30:00Z",
};

/** Renders a hook inside the app's real QueryClient configuration (same toast-on-error behaviour). */
function setup<T>(useHook: () => T) {
  const client = createQueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, ...renderHook(useHook, { wrapper }) };
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe("useCreateLoan", () => {
  it("refreshes loans, book availability and reservations after a successful loan", async () => {
    vi.mocked(createLoan).mockResolvedValue(loan);
    const { result, invalidate } = setup(useCreateLoan);

    await act(async () => {
      await result.current.mutateAsync({ member_id: 7, book_id: 12 });
    });

    expect(createLoan).toHaveBeenCalledWith({ member_id: 7, book_id: 12 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: loanKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: bookKeys.all }); // available_copies changed
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reservationKeys.all }); // the queue may have moved
  });

  it("shows the API's message as a toast and refreshes nothing when the loan is refused", async () => {
    const refusal = new ApiError({
      status: 409,
      code: "member_blocked",
      detail: "Member cannot borrow: unpaid fines of 4.50.",
    });
    vi.mocked(createLoan).mockRejectedValue(refusal);
    const { result, invalidate } = setup(useCreateLoan);

    await act(async () => {
      await expect(result.current.mutateAsync({ member_id: 7, book_id: 12 })).rejects.toMatchObject({
        code: "member_blocked",
      });
    });

    const messages = useToastStore.getState().toasts.map((toast) => toast.message);
    expect(messages).toContain("Member cannot borrow: unpaid fines of 4.50.");
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("useReturnLoan", () => {
  it("hands the fine back to the caller so the desk can announce it", async () => {
    const response: ReturnLoanResponse = { loan, fine };
    vi.mocked(returnLoan).mockResolvedValue(response);
    const { result } = setup(useReturnLoan);

    let returned: ReturnLoanResponse | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: 42 });
    });

    expect(returnLoan).toHaveBeenCalledWith(42, undefined);
    expect(returned?.fine?.amount).toBe("1.50");
  });
});
