import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getActivity, getMostBorrowed, getSummary } from "./api";

/** Every key starts with "dashboard" so a loan/fine change can invalidate the lot (see loans/hooks.ts). */
export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
  mostBorrowed: (days: number, limit: number) => [...dashboardKeys.all, "most-borrowed", days, limit] as const,
  activity: (page: number, pageSize: number) => [...dashboardKeys.all, "activity", page, pageSize] as const,
};

export function useDashboardSummary() {
  return useQuery({ queryKey: dashboardKeys.summary(), queryFn: ({ signal }) => getSummary(signal) });
}

export function useMostBorrowed(days = 30, limit = 5) {
  return useQuery({
    queryKey: dashboardKeys.mostBorrowed(days, limit),
    queryFn: ({ signal }) => getMostBorrowed({ days, limit }, signal),
  });
}

export function useActivity(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: dashboardKeys.activity(page, pageSize),
    queryFn: ({ signal }) => getActivity({ page, page_size: pageSize }, signal),
    placeholderData: keepPreviousData,
  });
}
