"use client";

import { useEffect } from "react";

import { ZyndErrorFallback } from "@/shared/components/zynd-error-fallback";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("[dashboard/error]", error);
  }, [error]);

  return <ZyndErrorFallback variant="page" onRetry={reset} />;
}
