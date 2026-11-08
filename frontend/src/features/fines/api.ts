import { apiClient } from "@/api/client";
import type { Paginated } from "@/api/types";
import type { Fine } from "@/features/loans/types";

export interface FineListParams {
  status?: Fine["status"];
  member?: number;
  page?: number;
  page_size?: number;
}

export async function listFines(params: FineListParams, signal?: AbortSignal): Promise<Paginated<Fine>> {
  const { data } = await apiClient.get<Paginated<Fine>>("/fines/", { params, signal });
  return data;
}

export async function payFine(id: number): Promise<Fine> {
  const { data } = await apiClient.post<Fine>(`/fines/${id}/pay/`, {});
  return data;
}

export async function waiveFine(id: number): Promise<Fine> {
  const { data } = await apiClient.post<Fine>(`/fines/${id}/waive/`, {});
  return data;
}
