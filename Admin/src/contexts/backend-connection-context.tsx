"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { fetchBackendHealthOk } from "@/components/maintenance-screen";
import {
  getBackendConnectionState,
  markBackendConnectionReady,
  markBackendConnectionWaiting,
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

    async function pollHealth() {
      const ok = await fetchBackendHealthOk();
      if (cancelled) return;
      if (ok) {
        markBackendConnectionReady();
      } else {
        markBackendConnectionWaiting();
      }
    }

    void pollHealth();
    const timer = window.setInterval(() => {
      void pollHealth();
    }, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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
