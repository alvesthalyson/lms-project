import { apiClient } from "@/api/client";
import type { Paginated } from "@/api/types";

import type { CreateReservationPayload, Reservation, ReservationListParams } from "./types";

export async function listReservations(
  params: ReservationListParams,
  signal?: AbortSignal,
): Promise<Paginated<Reservation>> {
  const { data } = await apiClient.get<Paginated<Reservation>>("/reservations/", { params, signal });
  return data;
}

export async function createReservation(payload: CreateReservationPayload): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>("/reservations/", payload);
  return data;
}

export async function cancelReservation(id: number): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>(`/reservations/${id}/cancel/`);
  return data;
}
