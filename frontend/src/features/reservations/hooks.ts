import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/hooks";

import { cancelReservation, createReservation, listReservations } from "./api";
import type { CreateReservationPayload, ReservationListParams } from "./types";

export const reservationKeys = {
  all: ["reservations"] as const,
  lists: () => [...reservationKeys.all, "list"] as const,
  list: (params: ReservationListParams) => [...reservationKeys.lists(), params] as const,
};

/** A reservation changes the queue, and cancelling a READY one frees a held copy: refresh both. */
function invalidateReservationRelated(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
    queryClient.invalidateQueries({ queryKey: bookKeys.lists() }),
  ]);
}

export function useReservations(params: ReservationListParams) {
  return useQuery({
    queryKey: reservationKeys.list(params),
    queryFn: ({ signal }) => listReservations(params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Errors (already reserved, book available, blocked member...) surface as a toast via the QueryClient. */
export function useReserveBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReservationPayload) => createReservation(payload),
    onSuccess: () => invalidateReservationRelated(queryClient),
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cancelReservation(id),
    onSuccess: () => invalidateReservationRelated(queryClient),
  });
}
