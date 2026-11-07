import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

import { installAuthInterceptors, type TokenAccess } from "./interceptors";

// No network anywhere: both axios instances use in-memory adapters.

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function reply(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return { data, status, statusText: String(status), headers: {}, config, request: {} };
}

function reject401(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError("HTTP 401", "ERR_BAD_REQUEST", config, {}, reply(config, 401, {
    detail: "Token is invalid or expired.",
    code: "token_not_valid",
    field_errors: {},
  }));
}

function memoryTokens(initial: { access: string | null; refresh: string | null }) {
  const state = { ...initial };
  const tokens: TokenAccess = {
    getAccess: () => state.access,
    getRefresh: () => state.refresh,
    setTokens: ({ access, refresh }) => {
      state.access = access;
      if (refresh) state.refresh = refresh;
    },
    clear: () => {
      state.access = null;
      state.refresh = null;
    },
  };
  return { state, tokens };
}

interface Harness {
  client: ReturnType<typeof axios.create>;
  state: { access: string | null; refresh: string | null };
  /** The refresh token sent on each call to /auth/refresh/. */
  refreshCalls: string[];
  /** `Authorization` header of every request that reached the API adapter. */
  apiAuthHeaders: Array<string | null>;
  onAuthFailure: ReturnType<typeof vi.fn>;
}

function setup(options: {
  tokens: { access: string | null; refresh: string | null };
  /** Does the refresh endpoint accept the token? */
  refreshOk?: boolean;
  /** Which Authorization header the fake API accepts. */
  validAuth?: string;
  apiDelayMs?: number;
}): Harness {
  const { refreshOk = true, validAuth = "Bearer new-access", apiDelayMs = 0 } = options;
  const { state, tokens } = memoryTokens(options.tokens);
  const refreshCalls: string[] = [];
  const apiAuthHeaders: Array<string | null> = [];
  const onAuthFailure = vi.fn();

  const refreshAdapter: AxiosAdapter = async (config) => {
    refreshCalls.push(JSON.parse(String(config.data)).refresh);
    await sleep(20); // stay in flight long enough for concurrent 401s to pile up behind it
    if (!refreshOk) throw reject401(config);
    return reply(config, 200, { access: "new-access", refresh: "new-refresh" });
  };

  const apiAdapter: AxiosAdapter = async (config) => {
    const auth = (config.headers.get("Authorization") as string | undefined) ?? null;
    apiAuthHeaders.push(auth);
    if (apiDelayMs) await sleep(apiDelayMs);
    if (auth === validAuth) return reply(config, 200, { ok: true, url: config.url });
    throw reject401(config);
  };

  const client = axios.create({ adapter: apiAdapter, baseURL: "http://test" });
  const refreshClient = axios.create({ adapter: refreshAdapter, baseURL: "http://test" });
  installAuthInterceptors(client, { refreshClient, tokens, onAuthFailure });

  return { client, state, refreshCalls, apiAuthHeaders, onAuthFailure };
}

describe("request interceptor", () => {
  it("adds the bearer token to API requests", async () => {
    const h = setup({ tokens: { access: "new-access", refresh: "r" } });
    await h.client.get("/books/");
    expect(h.apiAuthHeaders).toEqual(["Bearer new-access"]);
  });

  it("does not send a token on login", async () => {
    const h = setup({ tokens: { access: "new-access", refresh: "r" } });
    await h.client.get("/auth/login/").catch(() => undefined);
    expect(h.apiAuthHeaders).toEqual([null]);
  });
});

describe("401 handling", () => {
  it("refreshes ONCE for concurrent 401s, then retries every request successfully", async () => {
    const h = setup({ tokens: { access: "old-access", refresh: "old-refresh" } });

    const responses = await Promise.all([h.client.get("/a/"), h.client.get("/b/"), h.client.get("/c/")]);

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(h.refreshCalls).toEqual(["old-refresh"]); // exactly one refresh, with the stored token
    expect(h.state.access).toBe("new-access");
    expect(h.state.refresh).toBe("new-refresh"); // rotated refresh token is stored
    expect(h.onAuthFailure).toHaveBeenCalledTimes(0);
    // 3 original attempts with the stale token, then 3 retries with the new one
    expect(h.apiAuthHeaders.filter((header) => header === "Bearer old-access")).toHaveLength(3);
    expect(h.apiAuthHeaders.filter((header) => header === "Bearer new-access")).toHaveLength(3);
  });

  it("starts a fresh refresh for a later, separate expiry", async () => {
    const h = setup({ tokens: { access: "old-access", refresh: "old-refresh" } });
    await h.client.get("/a/");
    h.state.access = "expired-again"; // the new token expires later
    await h.client.get("/b/");
    expect(h.refreshCalls).toEqual(["old-refresh", "new-refresh"]);
  });

  it("clears the tokens, fires onAuthFailure once and rejects every waiting request with its 401 when the refresh fails", async () => {
    const h = setup({ tokens: { access: "old-access", refresh: "dead-refresh" }, refreshOk: false });

    const results = await Promise.allSettled([h.client.get("/a/"), h.client.get("/b/"), h.client.get("/c/")]);

    for (const result of results) {
      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason.response.status).toBe(401);
    }
    expect(h.refreshCalls).toEqual(["dead-refresh"]);
    expect(h.onAuthFailure).toHaveBeenCalledTimes(1);
    expect(h.state.access).toBeNull();
    expect(h.state.refresh).toBeNull();
  });

  it("passes a 401 through untouched when there is no refresh token (anonymous visitor)", async () => {
    const h = setup({ tokens: { access: null, refresh: null } });

    await expect(h.client.get("/private/")).rejects.toMatchObject({ response: { status: 401 } });

    expect(h.refreshCalls).toHaveLength(0);
    expect(h.onAuthFailure).toHaveBeenCalledTimes(0);
  });

  it("never refreshes because of a 401 from the auth endpoints themselves", async () => {
    const h = setup({ tokens: { access: "old-access", refresh: "old-refresh" } });

    await expect(h.client.post("/auth/login/", { email: "a@b.c", password: "wrong" })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(h.refreshCalls).toHaveLength(0);
    expect(h.apiAuthHeaders).toHaveLength(1); // no retry either
  });

  it("retries a request at most once", async () => {
    // The API keeps answering 401 even for the new token, so the retry fails too.
    const h = setup({ tokens: { access: "old-access", refresh: "old-refresh" }, validAuth: "Bearer never" });

    await expect(h.client.get("/a/")).rejects.toMatchObject({ response: { status: 401 } });

    expect(h.refreshCalls).toHaveLength(1);
    expect(h.apiAuthHeaders).toEqual(["Bearer old-access", "Bearer new-access"]); // original + one retry, no loop
  });

  it("retries with the current token, without a second refresh, when another request already refreshed", async () => {
    const h = setup({ tokens: { access: "old-access", refresh: "r" }, apiDelayMs: 30 });

    const pending = h.client.get("/slow/"); // goes out with old-access, answers 401 after 30 ms
    await sleep(10);
    h.state.access = "new-access"; // meanwhile some other request completed a refresh

    const response = await pending;
    expect(response.status).toBe(200);
    expect(h.refreshCalls).toHaveLength(0);
    expect(h.apiAuthHeaders).toEqual(["Bearer old-access", "Bearer new-access"]);
  });
});
