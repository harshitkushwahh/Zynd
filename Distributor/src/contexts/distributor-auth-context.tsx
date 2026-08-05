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
  getDisplayName,
  loginDistributor,
  signOutDistributor,
} from "@/lib/distributor-auth-api";
import {
  DISTRIBUTOR_DEMO_AGENTS,
  findDistributorAgent,
  type DistributorAgent,
} from "@/lib/distributor-agents";
import { getManagerBranchLabel, isBranchManager } from "@/lib/distributor-persona";
import type { DistributorSessionUser } from "@/lib/distributor-session-types";
import { env } from "@/lib/env";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const SESSION_STORAGE_KEY = "zynd-distributor-session";

type DistributorAuthContextValue = {
  user: DistributorSessionUser | null;
  loading: boolean;
  displayName: string;
  isBranchManager: boolean;
  branchLabel: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const DistributorAuthContext = createContext<DistributorAuthContextValue | null>(null);

function toSessionUser(agent: DistributorAgent): DistributorSessionUser {
  const { password: _password, ...rest } = agent;
  return { ...rest, authMode: "demo" };
}

function mergeDemoSessionWithAgentCatalog(
  session: DistributorSessionUser | null,
): DistributorSessionUser | null {
  if (!session || session.authMode === "api") return session;
  const agent = DISTRIBUTOR_DEMO_AGENTS.find((entry) => entry.id === session.id);
  if (!agent) return session;
  const { password: _password, ...rest } = agent;
  return { ...session, ...rest, authMode: "demo" as const };
}

function readStoredSession(): DistributorSessionUser | null {
  return mergeDemoSessionWithAgentCatalog(readStoredSessionRaw());
}

function readStoredSessionRaw(): DistributorSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DistributorSessionUser;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(user: DistributorSessionUser) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
}

export function DistributorAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DistributorSessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (env.useBackendClients) {
        const { user: apiUser } = await bootstrapDistributorSession();
        if (cancelled) return;
        if (apiUser) {
          const sessionUser: DistributorSessionUser = {
            id: apiUser.id,
            email: apiUser.email,
            name: getDisplayName(apiUser),
            role: "distributor",
            initials: getDisplayName(apiUser)
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            authMode: "api",
          };
          persistSession(sessionUser);
          setUser(sessionUser);
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
          setUser(null);
        }
        setLoading(false);
        return;
      }

      setUser(readStoredSession());
      setLoading(false);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (env.useBackendClients) {
      const apiUser = await loginDistributor(email, password);
      const sessionUser: DistributorSessionUser = {
        id: apiUser.id,
        email: apiUser.email,
        name: getDisplayName(apiUser),
        role: "distributor",
        initials: getDisplayName(apiUser)
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        authMode: "api",
      };
      persistSession(sessionUser);
      setUser(sessionUser);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
    const agent = findDistributorAgent(email, password);
    if (!agent) {
      throw new Error(ZYND_MITRA_COPY.demoAccountError);
    }
    const sessionUser = toSessionUser(agent);
    persistSession(sessionUser);
    setUser(sessionUser);
  }, []);

  const signOut = useCallback(() => {
    signOutDistributor();
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      displayName: user?.name ?? ZYND_MITRA_COPY.defaultRoleLabel,
      isBranchManager: isBranchManager(user),
      branchLabel: getManagerBranchLabel(user),
      signIn,
      signOut,
    }),
    [user, loading, signIn, signOut],
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
