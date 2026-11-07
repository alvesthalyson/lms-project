import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { setAuthFailureHandler } from "@/api/client";

import { fetchMe, login as loginRequest, logout as logoutRequest } from "./api";
import { useTokenStore } from "./tokenStore";
import type { AuthStatus, LoginPayload, User } from "./types";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (payload: LoginPayload) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthState {
  status: AuthStatus;
  user: User | null;
}

const ANONYMOUS: AuthState = { status: "anonymous", user: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // With a stored refresh token we start in "loading" and try to restore the session.
  const [state, setState] = useState<AuthState>(() =>
    useTokenStore.getState().refreshToken ? { status: "loading", user: null } : ANONYMOUS,
  );

  // The axios layer calls this when the refresh token is rejected (expired, revoked).
  useEffect(() => {
    setAuthFailureHandler(() => {
      queryClient.clear(); // drop cached private data
      setState(ANONYMOUS);
    });
    return () => setAuthFailureHandler(null);
  }, [queryClient]);

  // Restore the session on first load. There is no access token yet, so /users/me/ answers 401 and the
  // interceptor refreshes with the stored refresh token and retries: one code path for "expired" and "reload".
  useEffect(() => {
    if (!useTokenStore.getState().refreshToken) return;
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (!cancelled) setState({ status: "authenticated", user });
      })
      .catch(() => {
        if (!cancelled) setState(ANONYMOUS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await loginRequest(payload);
    useTokenStore.getState().setTokens({ access: data.access, refresh: data.refresh });
    setState({ status: "authenticated", user: data.user });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refresh = useTokenStore.getState().refreshToken;
    try {
      if (refresh) await logoutRequest(refresh);
    } catch {
      // Best effort: the local session ends either way.
    }
    useTokenStore.getState().clear();
    queryClient.clear();
    setState(ANONYMOUS);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ status: state.status, user: state.user, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
