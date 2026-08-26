"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DistributorPageChromeContextValue = {
  hideBreadcrumb: boolean;
  setHideBreadcrumb: (hide: boolean) => void;
};

const DistributorPageChromeContext = createContext<DistributorPageChromeContextValue | null>(null);

export function DistributorPageChromeProvider({ children }: { children: ReactNode }) {
  const [hideBreadcrumb, setHideBreadcrumb] = useState(false);
  const value = useMemo(
    () => ({
      hideBreadcrumb,
      setHideBreadcrumb,
    }),
    [hideBreadcrumb],
  );

  return (
    <DistributorPageChromeContext.Provider value={value}>{children}</DistributorPageChromeContext.Provider>
  );
}

export function useDistributorPageChrome() {
  const context = useContext(DistributorPageChromeContext);
  if (!context) {
    throw new Error("useDistributorPageChrome must be used within DistributorPageChromeProvider");
  }
  return context;
}
