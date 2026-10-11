"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { BackendConnectionDialog } from "@/components/backend-connection-dialog";
import { fetchBackendHealthOk } from "@/components/maintenance-screen";
import {
  getBackendConnectionState,
  markBackendConnectionReady,
  markBackendConnectionWaiting,
  subscribeBackendConnectionState,
  type BackendConnectionState,
} from "@/lib/api-client";

type BackendConnectionContextValue = BackendConnectionState;

const BackendConnectionContext = createContext<BackendConnectionContextValue | null>(null);

export function BackendConnectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<BackendConnectionState>(() => getBackendConnectionState());

  useEffect(() => subscribeBackendConnectionState(setState), []);

  useEffect(() => {
    let cancelled = false;

    async function pollHealth() {
      const ok = await fetchBackendHealthOk();
      if (cancelled) return;
      if (ok) {
        markBackendConnectionReady();
      } else {
        markBackendConnectionWaiting();
      }
    }

    function onResume() {
      if (document.visibilityState === "hidden") return;
      void pollHealth();
    }

    void pollHealth();
    const timer = window.setInterval(() => {
      void pollHealth();
    }, 12000);
    window.addEventListener("online", onResume);
    window.addEventListener("pageshow", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onResume);
      window.removeEventListener("pageshow", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  return (
    <BackendConnectionContext.Provider value={state}>
      {children}
      <BackendConnectionDialog open={state.isWaiting && pathname !== "/maintenance"} />
    </BackendConnectionContext.Provider>
  );
}

export function useBackendConnection() {
  const context = useContext(BackendConnectionContext);
  if (!context) {
    throw new Error("useBackendConnection must be used within BackendConnectionProvider");
  }
  return context;
}

export function useBackendConnectionOptional() {
  return useContext(BackendConnectionContext);
}
