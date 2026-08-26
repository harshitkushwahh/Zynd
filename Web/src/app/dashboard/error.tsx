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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ZyndErrorFallback variant="page" onRetry={reset} className="min-h-0 flex-1" />
    </div>
  );
}
