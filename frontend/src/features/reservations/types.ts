export type ReservationStatus = "PENDING" | "READY" | "FULFILLED" | "CANCELLED" | "EXPIRED";

export interface Reservation {
  id: number;
  member: { id: number; email: string; full_name: string; member_number: string | null };
  book: { id: number; title: string; isbn: string; cover_image: string | null };
  status: ReservationStatus;
  /** 1-based place in the FIFO queue; null unless PENDING. */
  queue_position: number | null;
  notified_at: string | null;
  expires_at: string | null;
  loan_id: number | null;
  created_at: string;
}

export interface ReservationListParams {
  status?: ReservationStatus;
  /** true = PENDING or READY. */
  active?: boolean;
  member?: number;
  book?: number;
  page?: number;
  page_size?: number;
}

/** Members reserve for themselves (omit member_id); staff may pass member_id. */
export interface CreateReservationPayload {
  book_id: number;
  member_id?: number;
}
