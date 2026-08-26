"use client";

import { useEffect } from "react";

import { DistributorHttpErrorPage } from "@/components/errors/distributor-http-error-page";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <DistributorHttpErrorPage
      code={500}
      referenceId={error.digest ?? null}
      detail={!error.digest && error.message ? error.message : null}
      homeHref="/dashboard"
      onRetry={reset}
      showBack={false}
      layout="standalone"
    />
  );
}
