"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin app error:", error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-4 rounded-[var(--radius-card)] border border-destructive/30 bg-card p-6 shadow-zynd-low">
        <h1 className="font-heading text-h4 font-semibold text-foreground">Something went wrong</h1>
        <p className="text-compact text-muted-foreground">
          {error.message || "An unexpected error occurred while rendering this page."}
        </p>
        {error.digest ? (
          <p className="font-mono text-caption text-muted-foreground">Error ID: {error.digest}</p>
        ) : null}
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
