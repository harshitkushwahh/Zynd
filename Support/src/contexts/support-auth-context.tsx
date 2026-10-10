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
  bootstrapSupportSession,
  supportLogin,
  supportLogout,
  supportVerifyLoginSms,
  supportVerifyMfa,
  resendSupportLoginSms,
  type SupportLoginFlowResponse,
  type SupportSessionUser,
} from "@/lib/support-auth-api";

type SupportAuthContextValue = {
  user: SupportSessionUser | null;
  permissions: string[];
  roleKeys: string[];
  loading: boolean;
  displayName: string;
  signIn: (email: string, password: string) => Promise<SupportLoginFlowResponse>;
  verifyMfa: (mfaToken: string, totpCode: string) => Promise<void>;
  verifyLoginSms: (loginToken: string, otp: string) => Promise<void>;
  resendLoginSms: (loginToken: string) => Promise<number>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const SupportAuthContext = createContext<SupportAuthContextValue | null>(null);

export function SupportAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupportSessionUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(
    (session: {
      sessionUser: SupportSessionUser | null;
      permissions: string[];
      roleKeys: string[];
    }) => {
      setUser(session.sessionUser);
      setPermissions(session.permissions);
      setRoleKeys(session.roleKeys);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await bootstrapSupportSession();
      if (cancelled) return;
      applySession(session);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await supportLogin(email.trim(), password);
    if (result.next === "authenticated") {
      const session = await bootstrapSupportSession();
      applySession(session);
    }
    return result;
  }, [applySession]);

  const verifyMfa = useCallback(
    async (mfaToken: string, totpCode: string) => {
      const sessionUser = await supportVerifyMfa(mfaToken, totpCode);
      const session = await bootstrapSupportSession();
      applySession({ ...session, sessionUser: sessionUser ?? session.sessionUser });
    },
    [applySession],
  );

  const verifyLoginSms = useCallback(
    async (loginToken: string, otp: string) => {
      const sessionUser = await supportVerifyLoginSms(loginToken, otp);
      const session = await bootstrapSupportSession();
      applySession({ ...session, sessionUser: sessionUser ?? session.sessionUser });
    },
    [applySession],
  );

  const resendLoginSmsHandler = useCallback(async (loginToken: string) => {
    return resendSupportLoginSms(loginToken);
  }, []);

  const signOut = useCallback(async () => {
    await supportLogout();
    applySession({ sessionUser: null, permissions: [], roleKeys: [] });
  }, [applySession]);

  const refreshUser = useCallback(async () => {
    const session = await bootstrapSupportSession();
    applySession(session);
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      permissions,
      roleKeys,
      loading,
      displayName: user?.name ?? "Support",
      signIn,
      verifyMfa,
      verifyLoginSms,
      resendLoginSms: resendLoginSmsHandler,
      signOut,
      refreshUser,
    }),
    [
      user,
      permissions,
      roleKeys,
      loading,
      signIn,
      verifyMfa,
      verifyLoginSms,
      resendLoginSmsHandler,
      signOut,
      refreshUser,
    ],
  );

  return (
    <SupportAuthContext.Provider value={value}>{children}</SupportAuthContext.Provider>
  );
}

export function useSupportAuth() {
  const context = useContext(SupportAuthContext);
  if (!context) {
    throw new Error("useSupportAuth must be used within SupportAuthProvider");
  }
  return context;
}
