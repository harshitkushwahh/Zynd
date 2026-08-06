"use client";

import { useEffect } from "react";

import { ZyndErrorFallback } from "@/shared/components/zynd-error-fallback";
import { rootFontClassName } from "@/shared/config/fonts";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en" className={`${rootFontClassName} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <ZyndErrorFallback variant="page" onRetry={reset} className="min-h-full flex-1" />
      </body>
    </html>
  );
}
