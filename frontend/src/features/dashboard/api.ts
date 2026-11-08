import { apiClient } from "@/api/client";
import type { Paginated } from "@/api/types";

import type { ActivityEntry, DashboardSummary, MostBorrowedRow } from "./types";

export async function getSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>("/dashboard/summary/", { signal });
  return data;
}

export async function getMostBorrowed(
  params: { days?: number; limit?: number },
  signal?: AbortSignal,
): Promise<MostBorrowedRow[]> {
  const { data } = await apiClient.get<MostBorrowedRow[]>("/dashboard/most-borrowed/", { params, signal });
  return data;
}

export async function getActivity(
  params: { page?: number; page_size?: number; action?: string },
  signal?: AbortSignal,
): Promise<Paginated<ActivityEntry>> {
  const { data } = await apiClient.get<Paginated<ActivityEntry>>("/dashboard/activity/", { params, signal });
  return data;
}
