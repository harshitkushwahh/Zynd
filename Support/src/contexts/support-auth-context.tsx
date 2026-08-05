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
  findSupportAgent,
  type SupportAgent,
} from "@/lib/support-agents";

const SESSION_STORAGE_KEY = "zynd-support-session";

type SupportSessionUser = Omit<SupportAgent, "password">;

type SupportAuthContextValue = {
  user: SupportSessionUser | null;
  loading: boolean;
  displayName: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const SupportAuthContext = createContext<SupportAuthContextValue | null>(null);

function toSessionUser(agent: SupportAgent): SupportSessionUser {
  const { password: _password, ...rest } = agent;
  return rest;
}

function readStoredSession(): SupportSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupportSessionUser;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function SupportAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupportSessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredSession());
    setLoading(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const agent = findSupportAgent(email, password);
    if (!agent) {
      throw new Error("Invalid email or password. Use a demo support account.");
    }
    const sessionUser = toSessionUser(agent);
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      displayName: user?.name ?? "Support",
      signIn,
      signOut,
    }),
    [user, loading, signIn, signOut],
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
