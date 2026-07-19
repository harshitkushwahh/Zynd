"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-full bg-muted text-foreground antialiased">
        <div className="flex min-h-full items-center justify-center px-4 py-empty-state-sm">
          <div className="w-full max-w-lg space-y-4 rounded-card border border-destructive/20 bg-card p-6 shadow-zynd-low">
            <h1 className="text-xl font-semibold">ZYND Admin failed to load</h1>
            <p className="text-compact text-muted-foreground">
              {error.message || "An unexpected error occurred."}
            </p>
            {error.digest ? (
              <p className="font-mono text-caption text-muted-foreground">Error ID: {error.digest}</p>
            ) : null}
            <button
              type="button"
              className="rounded-control bg-primary px-4 py-2 text-compact font-medium text-primary-foreground"
              onClick={() => reset()}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
