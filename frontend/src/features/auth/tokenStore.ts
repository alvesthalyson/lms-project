import { create } from "zustand";

import type { TokenAccess } from "@/api/interceptors";

const REFRESH_KEY = "lms.refresh_token";

// localStorage can throw (private mode, blocked site data) and is absent outside the browser.
function readRefresh(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(value: string | null): void {
  try {
    if (value) window.localStorage.setItem(REFRESH_KEY, value);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Not persisting just means the user signs in again after a reload.
  }
}

interface TokenState {
  /** Memory only: never written to storage, so it is gone on reload and recovered through the refresh token. */
  accessToken: string | null;
  /** Persisted so a reload keeps the session. */
  refreshToken: string | null;
  setTokens: (tokens: { access: string; refresh?: string | null }) => void;
  clear: () => void;
}

export const useTokenStore = create<TokenState>()((set) => ({
  accessToken: null,
  refreshToken: readRefresh(),
  setTokens: ({ access, refresh }) =>
    set((state) => {
      const nextRefresh = refresh ?? state.refreshToken;
      writeRefresh(nextRefresh);
      return { accessToken: access, refreshToken: nextRefresh };
    }),
  clear: () => {
    writeRefresh(null);
    set({ accessToken: null, refreshToken: null });
  },
}));

/** Non-React view of the store for the axios interceptors. */
export const tokenAccess: TokenAccess = {
  getAccess: () => useTokenStore.getState().accessToken,
  getRefresh: () => useTokenStore.getState().refreshToken,
  setTokens: (tokens) => useTokenStore.getState().setTokens(tokens),
  clear: () => useTokenStore.getState().clear(),
};
