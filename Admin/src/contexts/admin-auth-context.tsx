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
  adminLogin,
  adminLogout,
  adminVerifyMfa,
  bootstrapAdminSession,
  fetchAdminPermissions,
  fetchCurrentAdminUser,
  getDisplayName,
  isAuthenticatedResponse,
  type AdminLoginFlowResponse,
  type AdminUser,
} from "@/lib/auth-api";
import { setAccessToken } from "@/lib/api-client";

type AdminAuthContextValue = {
  user: AdminUser | null;
  permissions: string[];
  loading: boolean;
  displayName: string;
  signIn: (
    email: string,
    password: string,
    turnstileToken?: string | null
  ) => Promise<AdminLoginFlowResponse>;
  verifyMfa: (mfaToken: string, totpCode: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<string[]>;
  refreshUser: () => Promise<AdminUser | null>;
  completeSession: () => Promise<void>;
  hasPermission: (key: string) => boolean;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void bootstrapAdminSession().then((result) => {
      if (cancelled) return;
      setUser(result.user);
      setPermissions(result.permissions);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, turnstileToken?: string | null) => {
    const result = await adminLogin(email, password, turnstileToken);
    if (isAuthenticatedResponse(result)) {
      setUser(result.user);
      const nextPermissions = await fetchAdminPermissions();
      setPermissions(nextPermissions);
    }
    return result;
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, totpCode: string) => {
    const result = await adminVerifyMfa(mfaToken, totpCode);
    setUser(result.user);
    const nextPermissions = await fetchAdminPermissions();
    setPermissions(nextPermissions);
  }, []);

  const signOut = useCallback(async () => {
    await adminLogout();
    setUser(null);
    setPermissions([]);
    setAccessToken(null);
  }, []);

  const refreshPermissions = useCallback(async () => {
    const next = await fetchAdminPermissions();
    setPermissions(next);
    return next;
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const next = await fetchCurrentAdminUser();
      setUser(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const completeSession = useCallback(async () => {
    const next = await fetchCurrentAdminUser();
    setUser(next);
    const nextPermissions = await fetchAdminPermissions();
    setPermissions(nextPermissions);
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      user,
      permissions,
      loading,
      displayName: user ? getDisplayName(user) : "",
      signIn,
      verifyMfa,
      signOut,
      refreshPermissions,
      refreshUser,
      completeSession,
      hasPermission: (key: string) => permissions.includes(key),
    }),
    [completeSession, loading, permissions, refreshPermissions, refreshUser, signIn, signOut, user, verifyMfa]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}
