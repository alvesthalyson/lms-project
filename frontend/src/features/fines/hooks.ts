import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listFines, payFine, waiveFine, type FineListParams } from "./api";

export const fineKeys = {
  all: ["fines"] as const,
  list: (params: FineListParams) => [...fineKeys.all, "list", params] as const,
};

export function useFines(params: FineListParams) {
  return useQuery({
    queryKey: fineKeys.list(params),
    queryFn: ({ signal }) => listFines(params, signal),
    placeholderData: keepPreviousData,
  });
}

function useSettle(fn: (id: number) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // A settled fine can unblock the member and changes the dashboard totals.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: fineKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export const usePayFine = () => useSettle(payFine);
export const useWaiveFine = () => useSettle(waiveFine);
