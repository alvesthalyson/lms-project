import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router-dom";

import { router } from "@/app/router";
import { AuthProvider } from "@/features/auth/AuthContext";
import { createQueryClient } from "@/lib/query-client";

export function App() {
  // Created once per mount (not at module level) so the cache is never shared between tests or hot reloads.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
