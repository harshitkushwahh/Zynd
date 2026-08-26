"use client";

import { useEffect } from "react";

import { DistributorHttpErrorPage } from "@/components/errors/distributor-http-error-page";
import { DashboardErrorShell } from "@/components/errors/dashboard-error-shell";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("[dashboard/error]", error);
  }, [error]);

  return (
    <DashboardErrorShell>
      <DistributorHttpErrorPage
        code={500}
        referenceId={error.digest ?? null}
        detail={!error.digest && error.message ? error.message : null}
        homeHref="/dashboard"
        onRetry={reset}
        layout="viewport"
      />
    </DashboardErrorShell>
  );
}
