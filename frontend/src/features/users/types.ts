import type { User } from "@/features/auth/types";

export interface UserListParams {
  search?: string;
  role?: User["role"];
  is_blocked?: boolean;
  page?: number;
  page_size?: number;
}
