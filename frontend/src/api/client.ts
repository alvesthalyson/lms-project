import axios from "axios";

import { tokenAccess } from "@/features/auth/tokenStore";
import { env } from "@/lib/env";

import { toApiError } from "./errors";
import { installAuthInterceptors } from "./interceptors";

/** The one axios instance every feature api.ts uses. */
export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});

/** Interceptor-free instance, used only to call /auth/refresh/ (avoids refresh loops). */
const refreshClient = axios.create({ baseURL: env.apiUrl, timeout: 20_000 });

// The auth provider registers its handler here (instead of this module importing React state).
let authFailureHandler: (() => void) | null = null;
export function setAuthFailureHandler(handler: (() => void) | null): void {
  authFailureHandler = handler;
}

installAuthInterceptors(apiClient, {
  refreshClient,
  tokens: tokenAccess,
  onAuthFailure: () => authFailureHandler?.(),
});

// Registered last, so the auth interceptor still sees raw AxiosErrors.
apiClient.interceptors.response.use(undefined, (error: unknown) => Promise.reject(toApiError(error)));
