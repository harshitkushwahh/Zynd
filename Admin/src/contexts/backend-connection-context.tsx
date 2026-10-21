"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { fetchBackendHealthOk } from "@/components/maintenance-screen";
import {
  BACKEND_HEALTH_OK_INTERVAL_MS,
  backendDownPollDelayMs,
  getBackendConnectionState,
  markBackendConnectionDown,
  markBackendConnectionReady,
  subscribeBackendConnectionState,
  type BackendConnectionState,
} from "@/lib/api-client";
import { MaintenanceScreen } from "@/components/maintenance-screen";

type BackendConnectionContextValue = BackendConnectionState;

const BackendConnectionContext = createContext<BackendConnectionContextValue | null>(null);

export function BackendConnectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<BackendConnectionState>(() => getBackendConnectionState());

  useEffect(() => subscribeBackendConnectionState(setState), []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let failureCount = 0;
    let inFlight = false;

    const schedule = (delayMs: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void pollHealth();
      }, delayMs);
    };

    async function pollHealth() {
      if (cancelled || inFlight) return;
      inFlight = true;
      let ok = false;
      try {
        ok = await fetchBackendHealthOk();
      } finally {
        inFlight = false;
      }
      if (cancelled) return;
      if (ok) {
        failureCount = 0;
        markBackendConnectionReady();
        schedule(BACKEND_HEALTH_OK_INTERVAL_MS);
        return;
      }
      failureCount += 1;
      markBackendConnectionDown();
      schedule(backendDownPollDelayMs(failureCount));
    }

    void pollHealth();
    const onOnline = () => {
      failureCount = 0;
      void pollHealth();
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return (
    <BackendConnectionContext.Provider value={state}>
      {children}
      {state.isWaiting && pathname !== "/maintenance" ? (
        <div
          className="fixed inset-0 z-[200] overflow-y-auto"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="zynd-maintenance-title"
        >
          <MaintenanceScreen
            onBackOnline={() => {
              markBackendConnectionReady();
              window.location.reload();
            }}
          />
        </div>
      ) : null}
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
