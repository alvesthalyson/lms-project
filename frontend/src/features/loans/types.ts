export type LoanStatus = "active" | "overdue" | "returned";

export interface Loan {
  id: number;
  member: { id: number; email: string; full_name: string; member_number: string | null };
  copy: { id: number; barcode: string };
  book: { id: number; title: string; isbn: string; cover_image: string | null };
  loaned_at: string;
  /** YYYY-MM-DD */
  due_date: string;
  returned_at: string | null;
  status: LoanStatus;
  days_overdue: number;
  renewal_count: number;
}

export interface Fine {
  id: number;
  loan_id: number;
  member: { id: number; email: string; full_name: string; member_number: string | null };
  book: { id: number; title: string; isbn: string; cover_image: string | null };
  reason: "OVERDUE" | "LOST" | "DAMAGED";
  /** Decimal string, e.g. "1.50". */
  amount: string;
  status: "UNPAID" | "PAID" | "WAIVED";
  paid_at: string | null;
  note: string;
  created_at: string;
}

export interface LoanListParams {
  status?: LoanStatus;
  member?: number;
  book?: number;
  copy?: number;
  search?: string;
  ordering?: "-loaned_at" | "loaned_at" | "due_date" | "returned_at";
  page?: number;
  page_size?: number;
}

/** Provide member_id and exactly one of copy_id or book_id (docs/API.md 4.4). */
export type CreateLoanPayload = { member_id: number; due_date?: string } & (
  | { copy_id: number; book_id?: never }
  | { book_id: number; copy_id?: never }
);

export interface ReturnLoanPayload {
  copy_status?: "AVAILABLE" | "DAMAGED";
  condition_notes?: string;
}

export interface ReturnLoanResponse {
  loan: Loan;
  /** null for an on-time return. */
  fine: Fine | null;
}
