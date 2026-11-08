export interface DashboardSummary {
  books: { titles: number; copies_total: number; copies_available: number };
  members: { total: number; blocked: number };
  loans: { active: number; overdue: number };
  reservations: { pending: number; ready: number };
  fines: { unpaid_count: number; /** Decimal string, e.g. "63.50". */ unpaid_total: string };
}

export interface MostBorrowedRow {
  book: { id: number; title: string; isbn: string; cover_image: string | null };
  loan_count: number;
}

export interface ActivityEntry {
  id: number;
  action: string;
  action_label: string;
  actor: { id: number; email: string; full_name: string; member_number: string | null } | null;
  member: { id: number; email: string; full_name: string; member_number: string | null } | null;
  book: { id: number; title: string; isbn: string; cover_image: string | null } | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
