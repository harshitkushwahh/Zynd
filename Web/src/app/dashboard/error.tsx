"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { copy } from "@/shared/config/copy";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("[dashboard/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
      <PageTitle>{copy.dashboard.error.boundaryTitle}</PageTitle>
      <p className="mt-2 max-w-md text-compact text-muted-foreground">
        {copy.dashboard.error.boundaryDescription}
      </p>
      <Button type="button" className="mt-6" onClick={reset}>
        {copy.dashboard.error.retry}
      </Button>
    </div>
  );
}
