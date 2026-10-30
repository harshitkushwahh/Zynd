"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  bootstrapSession,
  fetchCurrentUser,
  getDisplayName,
  isAuthenticatedResponse,
  login,
  loginWithApple,
  loginWithGoogle,
  logout,
  type AppleLoginProfile,
  type AuthUser,
  type LoginFlowResponse,
} from "@/lib/auth-api";
import { hasSessionHint } from "@/features/auth/api/auth-response";
import { revokeWebPushDevice } from "@/features/notifications/lib/push-device-registration";
import { isAuthFailure, setAccessToken } from "@/lib/api-client";
import {
  clearAuthSessionSnapshot,
  readAuthSessionSnapshot,
  writeAuthSessionSnapshot,
} from "@/lib/auth-session-cache";
import {
  clearPersistedAuthSession,
  readPersistedAuthUser,
  writePersistedAuthUser,
} from "@/lib/auth-session-storage";
import { clearQueryCache, getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { appConfig } from "@/shared/config/app-config";
import { clearOverviewReadyLatch } from "@/features/dashboard/overview/lib/overview-ready-latch";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  /** False until the first in-flight session restore (refresh cookie → access token) finishes. */
  sessionRestoring: boolean;
  sessionRetrying: boolean;
  displayName: string;
  signIn: (email: string, password: string, turnstileToken?: string | null) => Promise<LoginFlowResponse>;
  signInWithGoogle: (idToken: string) => Promise<LoginFlowResponse>;
  signInWithApple: (idToken: string, profile?: AppleLoginProfile) => Promise<LoginFlowResponse>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser | null) => void;
  setAccessTokenFromAuth: (token: string) => void;
  completeAuth: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** SSR-safe: do not read sessionStorage/localStorage here (client initializer would diverge from server HTML). */
function initialUser(): AuthUser | null {
  return readAuthSessionSnapshot()?.user ?? null;
}

function initialLoading(): boolean {
  const cached = readAuthSessionSnapshot();
  if (cached?.bootstrapped) return false;
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cached = readAuthSessionSnapshot();
  const [user, setUserState] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(initialLoading);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const [sessionRetrying, setSessionRetrying] = useState(
    () => cached?.sessionRetrying ?? false,
  );
  const bootstrapInFlightRef = useRef<Promise<void> | null>(null);
  const retryAttemptRef = useRef(0);
  const storageHydratedRef = useRef(false);

  useLayoutEffect(() => {
    if (storageHydratedRef.current) return;
    storageHydratedRef.current = true;

    const persisted = readPersistedAuthUser();
    if (persisted) {
      setUserState((current) => current ?? persisted);
    }
    if (hasSessionHint()) {
      setSessionRetrying(true);
      setLoading(true);
    }
  }, []);

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next);
    writePersistedAuthUser(next);
  }, []);

  useEffect(() => {
    writeAuthSessionSnapshot({
      user,
      sessionRetrying,
      bootstrapped: !loading,
    });
  }, [loading, sessionRetrying, user]);

  const applyBootstrapResult = useCallback(
    (result: Awaited<ReturnType<typeof bootstrapSession>>) => {
      if (result.user) {
        setUser(result.user);
        setSessionRetrying(false);
        retryAttemptRef.current = 0;
        setLoading(false);
        return;
      }

      if (result.reason === "network") {
        if (hasSessionHint()) {
          setSessionRetrying(true);
          setLoading(true);
        } else {
          setSessionRetrying(false);
          setLoading(false);
        }
        return;
      }

      clearPersistedAuthSession();
      setUser(null);
      setSessionRetrying(false);
      retryAttemptRef.current = 0;
      setLoading(false);
    },
    [setUser],
  );

  const runBootstrap = useCallback(async () => {
    if (bootstrapInFlightRef.current) {
      await bootstrapInFlightRef.current;
      return;
    }
    const task = (async () => {
      const result = await bootstrapSession();
      applyBootstrapResult(result);
    })().finally(() => {
      bootstrapInFlightRef.current = null;
      setSessionRestoring(false);
    });
    bootstrapInFlightRef.current = task;
    await task;
  }, [applyBootstrapResult]);

  useEffect(() => {
    void runBootstrap();
  }, [runBootstrap]);

  useEffect(() => {
    if (!sessionRetrying) return;

    let cancelled = false;
    let timerId: number | undefined;

    const schedule = () => {
      const attempt = retryAttemptRef.current;
      const delay = Math.min(
        appConfig.sessionRetryIntervalMs * (attempt + 1),
        appConfig.sessionRetryMaxIntervalMs,
      );
      timerId = window.setTimeout(() => {
        if (cancelled) return;
        void bootstrapSession().then((result) => {
          if (cancelled) return;
          if (result.user) {
            setUser(result.user);
            setSessionRetrying(false);
            retryAttemptRef.current = 0;
            setLoading(false);
            return;
          }
          if (result.reason === "expired") {
            clearPersistedAuthSession();
            setUser(null);
            setSessionRetrying(false);
            retryAttemptRef.current = 0;
            setLoading(false);
            return;
          }
          retryAttemptRef.current += 1;
          if (retryAttemptRef.current >= appConfig.sessionRetryMaxAttempts) {
            clearPersistedAuthSession();
            setUser(null);
            setSessionRetrying(false);
            retryAttemptRef.current = 0;
            setLoading(false);
            return;
          }
          schedule();
        });
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [sessionRetrying, setUser]);

  useEffect(() => {
    const recover = () => {
      if (document.visibilityState === "hidden") return;
      if (!hasSessionHint()) return;
      if (user) return;
      if (sessionRetrying) return;
      if (bootstrapInFlightRef.current) return;
      void runBootstrap();
    };

    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [runBootstrap, sessionRetrying, user]);

  const signIn = useCallback(
    async (email: string, password: string, turnstileToken?: string | null) => {
      const result = await login(email, password, turnstileToken);
      if (isAuthenticatedResponse(result)) {
        setUser(result.user);
      }
      return result;
    },
    [setUser],
  );

  const signInWithGoogleToken = useCallback(
    async (idToken: string) => {
      const result = await loginWithGoogle(idToken);
      if (isAuthenticatedResponse(result)) {
        setUser(result.user);
      }
      return result;
    },
    [setUser],
  );

  const signInWithAppleToken = useCallback(
    async (idToken: string, profile?: AppleLoginProfile) => {
      const result = await loginWithApple(idToken, profile);
      if (isAuthenticatedResponse(result)) {
        setUser(result.user);
      }
      return result;
    },
    [setUser],
  );

  const signOut = useCallback(async () => {
    try {
      await revokeWebPushDevice();
      await logout();
    } finally {
      clearAuthSessionSnapshot();
      clearPersistedAuthSession();
      clearOverviewReadyLatch();
      setUserState(null);
      setAccessToken(null);
      clearQueryCache();
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const next = await fetchCurrentUser();
      setUser(next);
      getQueryClient().invalidateQueries({ queryKey: queryKeys.auth.fundEligibility() });
      return next;
    } catch (error) {
      if (!isAuthFailure(error)) {
        return null;
      }

      const restored = await bootstrapSession();
      if (restored.user) {
        setUser(restored.user);
        setSessionRetrying(false);
        getQueryClient().invalidateQueries({ queryKey: queryKeys.auth.fundEligibility() });
        return restored.user;
      }

      if (restored.reason === "expired") {
        clearAuthSessionSnapshot();
        clearPersistedAuthSession();
        clearOverviewReadyLatch();
        setUser(null);
        setAccessToken(null);
      }
      return null;
    }
  }, [setUser]);

  const completeAuth = useCallback(
    (nextUser: AuthUser) => {
      setUser(nextUser);
    },
    [setUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionRestoring,
      sessionRetrying,
      displayName: user ? getDisplayName(user) : "",
      signIn,
      signInWithGoogle: signInWithGoogleToken,
      signInWithApple: signInWithAppleToken,
      signOut,
      refreshUser,
      setUser,
      setAccessTokenFromAuth: setAccessToken,
      completeAuth,
    }),
    [
      completeAuth,
      loading,
      refreshUser,
      sessionRestoring,
      sessionRetrying,
      setUser,
      signIn,
      signInWithAppleToken,
      signInWithGoogleToken,
      signOut,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
