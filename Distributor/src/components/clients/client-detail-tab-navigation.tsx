"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ClientDetailTabId } from "@/components/clients/client-detail-tab-ids";

type ClientDetailTabNavigationContextValue = {
  navigateToTab: (tabId: ClientDetailTabId) => void;
};

const ClientDetailTabNavigationContext =
  createContext<ClientDetailTabNavigationContextValue | null>(null);

export function ClientDetailTabNavigationProvider({
  navigateToTab,
  children,
}: {
  navigateToTab: (tabId: ClientDetailTabId) => void;
  children: ReactNode;
}) {
  return (
    <ClientDetailTabNavigationContext.Provider value={{ navigateToTab }}>
      {children}
    </ClientDetailTabNavigationContext.Provider>
  );
}

export function useClientDetailTabNavigation() {
  return useContext(ClientDetailTabNavigationContext);
}
