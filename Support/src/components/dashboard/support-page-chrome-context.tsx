"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type SupportPageChromeContextValue = {
  hideBreadcrumb: boolean;
  setHideBreadcrumb: (hide: boolean) => void;
};

const SupportPageChromeContext = createContext<SupportPageChromeContextValue | null>(null);

export function SupportPageChromeProvider({ children }: { children: ReactNode }) {
  const [hideBreadcrumb, setHideBreadcrumb] = useState(false);
  const value = useMemo(
    () => ({
      hideBreadcrumb,
      setHideBreadcrumb,
    }),
    [hideBreadcrumb],
  );

  return (
    <SupportPageChromeContext.Provider value={value}>{children}</SupportPageChromeContext.Provider>
  );
}

export function useSupportPageChrome() {
  const context = useContext(SupportPageChromeContext);
  if (!context) {
    throw new Error("useSupportPageChrome must be used within SupportPageChromeProvider");
  }
  return context;
}
