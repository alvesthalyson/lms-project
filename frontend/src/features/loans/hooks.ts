import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/hooks";
import { reservationKeys } from "@/features/reservations/hooks";

import { createLoan, listLoans, renewLoan, returnLoan } from "./api";
import type { CreateLoanPayload, LoanListParams, ReturnLoanPayload } from "./types";

export const loanKeys = {
  all: ["loans"] as const,
  lists: () => [...loanKeys.all, "list"] as const,
  list: (params: LoanListParams) => [...loanKeys.lists(), params] as const,
};

/**
 * A loan change ripples outward: book availability counters, the reservation queue
 * (a return promotes the next reservation), the member's borrowing status and the
 * dashboard numbers. Invalidate them all; React Query only refetches what is on screen.
 */
function invalidateAfterLoanChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: loanKeys.all }),
    queryClient.invalidateQueries({ queryKey: bookKeys.all }),
    queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["users"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
}

export function useLoans(params: LoanListParams) {
  return useQuery({
    queryKey: loanKeys.list(params),
    queryFn: ({ signal }) => listLoans(params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Staff only. 409s (member_blocked, loan_limit_reached, no_copy_available...) show as a toast. */
export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLoanPayload) => createLoan(payload),
    onSuccess: () => invalidateAfterLoanChange(queryClient),
  });
}

export function useRenewLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => renewLoan(id),
    onSuccess: () => invalidateAfterLoanChange(queryClient),
  });
}

/** Staff only. The response carries the fine (or null), so callers can announce it. */
export function useReturnLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload?: ReturnLoanPayload }) => returnLoan(id, payload),
    onSuccess: () => invalidateAfterLoanChange(queryClient),
  });
}
