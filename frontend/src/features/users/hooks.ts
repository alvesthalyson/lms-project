import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { listUsers } from "./api";
import type { UserListParams } from "./types";

export function useUsers(params: UserListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["users", "list", params],
    queryFn: ({ signal }) => listUsers(params, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}
