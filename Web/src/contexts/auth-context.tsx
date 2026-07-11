"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { clearSessionHint } from "@/features/auth/api/auth-response";
import { revokeWebPushDevice } from "@/features/notifications/lib/push-device-registration";
import { isAuthFailure, setAccessToken } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionRetrying, setSessionRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const result = await bootstrapSession();
      if (cancelled) return;

      if (result.user) {
        setUser(result.user);
        setSessionRetrying(false);
        setLoading(false);
        return;
      }

      if (result.reason === "network") {
        setSessionRetrying(true);
        setLoading(false);
        return;
      }

      setUser(null);
      setSessionRetrying(false);
      setLoading(false);
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionRetrying) return;

    const intervalId = window.setInterval(() => {
      void bootstrapSession().then((result) => {
        if (result.user) {
          setUser(result.user);
          setSessionRetrying(false);
          return;
        }

        if (result.reason === "expired") {
          setUser(null);
          setSessionRetrying(false);
        }
      });
    }, appConfig.sessionRetryIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [sessionRetrying]);

  const signIn = useCallback(async (email: string, password: string, turnstileToken?: string | null) => {
    const result = await login(email, password, turnstileToken);
    if (isAuthenticatedResponse(result)) {
      setUser(result.user);
    }
    return result;
  }, []);

  const signInWithGoogleToken = useCallback(async (idToken: string) => {
    const result = await loginWithGoogle(idToken);
    if (isAuthenticatedResponse(result)) {
      setUser(result.user);
    }
    return result;
  }, []);

  const signInWithAppleToken = useCallback(async (idToken: string, profile?: AppleLoginProfile) => {
    const result = await loginWithApple(idToken, profile);
    if (isAuthenticatedResponse(result)) {
      setUser(result.user);
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await revokeWebPushDevice();
      await logout();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const next = await fetchCurrentUser();
      setUser(next);
      return next;
    } catch (error) {
      if (!isAuthFailure(error)) {
        return null;
      }

      const restored = await bootstrapSession();
      if (restored.user) {
        setUser(restored.user);
        setSessionRetrying(false);
        return restored.user;
      }

      if (restored.reason === "expired") {
        setUser(null);
        setAccessToken(null);
        clearSessionHint();
      }
      return null;
    }
  }, []);

  const completeAuth = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
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
    [completeAuth, loading, refreshUser, sessionRetrying, signIn, signInWithAppleToken, signInWithGoogleToken, signOut, user]
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
