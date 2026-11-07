import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

/** What the interceptors need from the token store (kept as an interface so it is testable without React/Zustand). */
export interface TokenAccess {
  getAccess(): string | null;
  getRefresh(): string | null;
  setTokens(tokens: { access: string; refresh?: string | null }): void;
  clear(): void;
}

export interface AuthInterceptorOptions {
  /** A plain axios instance WITHOUT these interceptors, used only to call the refresh endpoint. */
  refreshClient: AxiosInstance;
  tokens: TokenAccess;
  /** Called once when the session cannot be recovered (refresh token missing/expired/blacklisted). */
  onAuthFailure: () => void;
  refreshPath?: string;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Login, register and refresh answer 401 for bad credentials; those must never trigger a refresh. */
const AUTH_ENDPOINT = /\/auth\/(login|register|refresh)\/?(\?|$)/;

export function isAuthEndpoint(url: string | undefined): boolean {
  return url !== undefined && AUTH_ENDPOINT.test(url);
}

/**
 * Attach the access token to requests and recover from 401s.
 *
 *  1. Request: add `Authorization: Bearer <access>` (never on login/register/refresh).
 *  2. Response 401 on a request that was not already retried: refresh the access token and retry once.
 *  3. Concurrent 401s share ONE in-flight refresh (single-flight). The API rotates refresh tokens and
 *     blacklists the old one, so a second parallel refresh with the same token would fail and log the user out.
 *  4. If the refresh fails, clear the tokens and call `onAuthFailure` once; every waiting request
 *     rejects with its original 401.
 *
 * Without a refresh token (anonymous visitor) a 401 is simply passed through.
 */
export function installAuthInterceptors(client: AxiosInstance, options: AuthInterceptorOptions): void {
  const { refreshClient, tokens, onAuthFailure, refreshPath = "/auth/refresh/" } = options;

  let inFlight: Promise<string> | null = null;

  async function doRefresh(): Promise<string> {
    const refresh = tokens.getRefresh();
    if (!refresh) throw new Error("No refresh token");
    try {
      const { data } = await refreshClient.post<{ access: string; refresh?: string }>(refreshPath, { refresh });
      tokens.setTokens({ access: data.access, refresh: data.refresh });
      return data.access;
    } catch (error) {
      tokens.clear();
      onAuthFailure();
      throw error;
    }
  }

  function refreshOnce(): Promise<string> {
    if (!inFlight) {
      inFlight = doRefresh().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  client.interceptors.request.use((config) => {
    const access = tokens.getAccess();
    if (access && !isAuthEndpoint(config.url) && !config.headers.has("Authorization")) {
      config.headers.set("Authorization", `Bearer ${access}`);
    }
    return config;
  });

  client.interceptors.response.use(undefined, async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;

    const original = error.config as RetriableConfig | undefined;
    if (!original || error.response?.status !== 401 || original._retry || isAuthEndpoint(original.url)) {
      throw error;
    }
    if (!tokens.getRefresh()) throw error; // not signed in: nothing to recover

    original._retry = true;

    // This request went out with a token that has since been replaced by another
    // request's refresh: just retry with the current token, no second refresh.
    const sent = original.headers.get("Authorization");
    const current = tokens.getAccess();

    let access: string;
    if (current && sent !== `Bearer ${current}`) {
      access = current;
    } else {
      try {
        access = await refreshOnce();
      } catch {
        throw error; // surface the original 401, not the refresh failure
      }
    }

    original.headers.set("Authorization", `Bearer ${access}`);
    return client.request(original);
  });
}
