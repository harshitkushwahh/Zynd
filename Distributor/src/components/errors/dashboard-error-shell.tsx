"use client";

import { useEffect } from "react";

import { useDistributorPageChrome } from "@/components/dashboard/distributor-page-chrome-context";

type DashboardErrorShellProps = {
  children: React.ReactNode;
};

export function DashboardErrorShell({ children }: DashboardErrorShellProps) {
  const { setHideBreadcrumb } = useDistributorPageChrome();

  useEffect(() => {
    setHideBreadcrumb(true);
    return () => setHideBreadcrumb(false);
  }, [setHideBreadcrumb]);

  return children;
}
