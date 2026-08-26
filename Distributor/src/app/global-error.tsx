"use client";

import { useEffect } from "react";

import { DistributorHttpErrorPage } from "@/components/errors/distributor-http-error-page";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <DistributorHttpErrorPage
          code={500}
          referenceId={error.digest ?? null}
          detail={!error.digest && error.message ? error.message : null}
          homeHref="/dashboard"
          onRetry={reset}
          showBack={false}
          layout="standalone"
        />
      </body>
    </html>
  );
}
