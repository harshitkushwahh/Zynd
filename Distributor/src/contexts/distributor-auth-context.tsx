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

import "@/lib/api-client";
import {
  bootstrapDistributorSession,
  completeDistributorLogin,
  distributorLogin,
  distributorLogout,
  distributorVerifyLoginSms,
  distributorVerifyMfa,
  fetchDistributorPermissions,
  isAuthenticatedResponse,
  refreshDistributorSessionUser,
  resendDistributorLoginSms,
  type DistributorLoginFlowResponse,
} from "@/lib/distributor-auth-api";
import { getManagerBranchLabel, isBranchManager } from "@/lib/distributor-persona";
import type { DistributorSessionUser } from "@/lib/distributor-session-types";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const SESSION_STORAGE_KEY = "zynd-distributor-session";

type DistributorAuthContextValue = {
  user: DistributorSessionUser | null;
  permissions: string[];
  loading: boolean;
  displayName: string;
  isBranchManager: boolean;
  branchLabel: string;
  signIn: (email: string, password: string) => Promise<DistributorLoginFlowResponse>;
  verifyMfa: (mfaToken: string, totpCode: string) => Promise<void>;
  verifyLoginSms: (loginToken: string, otp: string) => Promise<void>;
  resendLoginSms: (loginToken: string) => Promise<number>;
  signOut: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  refreshUser: () => Promise<DistributorSessionUser | null>;
};

const DistributorAuthContext = createContext<DistributorAuthContextValue | null>(null);

function persistSession(user: DistributorSessionUser) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
}

export function DistributorAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DistributorSessionUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const { sessionUser, permissions: nextPermissions } = await bootstrapDistributorSession();
      if (cancelled) return;
      if (sessionUser) {
        persistSession(sessionUser);
        setUser(sessionUser);
        setPermissions(nextPermissions);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        setUser(null);
        setPermissions([]);
      }
      setLoading(false);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await distributorLogin(email, password);
    if (isAuthenticatedResponse(result)) {
      const session = await completeDistributorLogin(result.user);
      persistSession(session.sessionUser);
      setUser(session.sessionUser);
      setPermissions(session.permissions);
    }
    return result;
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, totpCode: string) => {
    const sessionUser = await distributorVerifyMfa(mfaToken, totpCode);
    const nextPermissions = await fetchDistributorPermissions();
    persistSession(sessionUser);
    setUser(sessionUser);
    setPermissions(nextPermissions);
  }, []);

  const verifyLoginSms = useCallback(async (loginToken: string, otp: string) => {
    const sessionUser = await distributorVerifyLoginSms(loginToken, otp);
    const nextPermissions = await fetchDistributorPermissions();
    persistSession(sessionUser);
    setUser(sessionUser);
    setPermissions(nextPermissions);
  }, []);

  const resendLoginSms = useCallback(async (loginToken: string) => {
    const result = await resendDistributorLoginSms(loginToken);
    return result.retry_after_seconds;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await distributorLogout();
    } catch {
      // Clear local session even if the server logout fails.
    }
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
    setPermissions([]);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const session = await refreshDistributorSessionUser();
      persistSession(session.sessionUser);
      setUser(session.sessionUser);
      setPermissions(session.permissions);
      return session.sessionUser;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      permissions,
      loading,
      displayName: user?.name ?? ZYND_MITRA_COPY.defaultRoleLabel,
      isBranchManager: isBranchManager(user),
      branchLabel: getManagerBranchLabel(user),
      signIn,
      verifyMfa,
      verifyLoginSms,
      resendLoginSms,
      signOut,
      hasPermission: (key: string) => permissions.includes(key),
      refreshUser,
    }),
    [user, permissions, loading, signIn, verifyMfa, verifyLoginSms, resendLoginSms, signOut, refreshUser],
  );

  return (
    <DistributorAuthContext.Provider value={value}>{children}</DistributorAuthContext.Provider>
  );
}

export function useDistributorAuth() {
  const context = useContext(DistributorAuthContext);
  if (!context) {
    throw new Error("useDistributorAuth must be used within DistributorAuthProvider");
  }
  return context;
}
