export type Role = "ADMIN" | "LIBRARIAN" | "MEMBER";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  member_number: string | null;
  phone: string;
  address: string;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason: string;
  blocked_at: string | null;
  date_joined: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export type AuthStatus = "loading" | "authenticated" | "anonymous";
