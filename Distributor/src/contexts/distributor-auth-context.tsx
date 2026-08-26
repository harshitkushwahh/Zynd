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
import { getManagerBranchLabel, isBranchManager, canManageBranchBook } from "@/lib/distributor-persona";
import type { DistributorSessionUser } from "@/lib/distributor-session-types";
import {
  clearPersistedDistributorSession,
  persistDistributorSession,
  readPersistedDistributorSession,
} from "@/lib/distributor-session-storage";
import { clearPinUnlock } from "@/lib/distributor-pin-unlock-storage";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type DistributorAuthContextValue = {
  user: DistributorSessionUser | null;
  permissions: string[];
  loading: boolean;
  displayName: string;
  isBranchManager: boolean;
  canManageBranchBook: boolean;
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

export function DistributorAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DistributorSessionUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const cachedUser = readPersistedDistributorSession();

      const { sessionUser, permissions: nextPermissions, reason, tokenRefreshed } =
        await bootstrapDistributorSession();
      if (cancelled) return;

      if (sessionUser) {
        persistDistributorSession(sessionUser);
        setUser(sessionUser);
        setPermissions(nextPermissions);
        if (nextPermissions.length === 0 && tokenRefreshed) {
          void fetchDistributorPermissions()
            .then((permissions) => {
              if (!cancelled) setPermissions(permissions);
            })
            .catch(() => undefined);
        }
      } else if (reason === "expired") {
        clearPersistedDistributorSession();
        setUser(null);
        setPermissions([]);
      } else if (!tokenRefreshed && cachedUser) {
        // Offline — keep the last known profile only when the session could not be refreshed.
        setUser(cachedUser);
      } else {
        clearPersistedDistributorSession();
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
      clearPinUnlock(session.sessionUser.id);
      persistDistributorSession(session.sessionUser);
      setUser(session.sessionUser);
      setPermissions(session.permissions);
    }
    return result;
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, totpCode: string) => {
    const sessionUser = await distributorVerifyMfa(mfaToken, totpCode);
    clearPinUnlock(sessionUser.id);
    const nextPermissions = await fetchDistributorPermissions();
    persistDistributorSession(sessionUser);
    setUser(sessionUser);
    setPermissions(nextPermissions);
  }, []);

  const verifyLoginSms = useCallback(async (loginToken: string, otp: string) => {
    const sessionUser = await distributorVerifyLoginSms(loginToken, otp);
    clearPinUnlock(sessionUser.id);
    const nextPermissions = await fetchDistributorPermissions();
    persistDistributorSession(sessionUser);
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
    clearPersistedDistributorSession();
    setUser(null);
    setPermissions([]);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const session = await refreshDistributorSessionUser();
      persistDistributorSession(session.sessionUser);
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
      canManageBranchBook: canManageBranchBook(user),
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
