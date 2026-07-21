"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { BackendConnectionDialog } from "@/components/backend-connection-dialog";
import {
  getBackendConnectionState,
  subscribeBackendConnectionState,
  type BackendConnectionState,
} from "@/lib/api-client";

type BackendConnectionContextValue = BackendConnectionState;

const BackendConnectionContext = createContext<BackendConnectionContextValue | null>(null);

export function BackendConnectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BackendConnectionState>(() => getBackendConnectionState());

  useEffect(() => subscribeBackendConnectionState(setState), []);

  return (
    <BackendConnectionContext.Provider value={state}>
      {children}
      <BackendConnectionDialog open={state.isWaiting} />
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
