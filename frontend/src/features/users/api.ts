import { apiClient } from "@/api/client";
import type { Paginated } from "@/api/types";
import type { User } from "@/features/auth/types";

import type { UserListParams } from "./types";

/** Staff only (GET /users/). The loan desk uses it to find a member. */
export async function listUsers(params: UserListParams, signal?: AbortSignal): Promise<Paginated<User>> {
  const { data } = await apiClient.get<Paginated<User>>("/users/", { params, signal });
  return data;
}
