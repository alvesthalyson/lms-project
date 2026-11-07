import { MutationCache, QueryClient } from "@tanstack/react-query";

import { toApiError } from "@/api/errors";
import { toast } from "@/lib/toast";

/**
 * One factory so the app and the tests build identically configured clients
 * (tests override `retry`).
 *
 * Mutations show a toast with the API's `detail` on failure, unless the mutation
 * opts out with `meta: { silent: true }` (forms that render errors inline).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const { status } = toApiError(error);
          if (status >= 400 && status < 500) return false; // client errors will not fix themselves
          return failureCount < 2;
        },
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return;
        toast.error(toApiError(error).detail);
      },
    }),
  });
}
