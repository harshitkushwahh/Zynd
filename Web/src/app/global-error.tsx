"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";
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
      <body className="flex min-h-full flex-col items-center justify-center bg-background px-6 font-sans text-foreground">
        <h1 className="text-h3 font-semibold">{copy.dashboard.error.boundaryTitle}</h1>
        <p className="mt-2 max-w-md text-center text-compact text-muted-foreground">
          {copy.dashboard.error.boundaryDescription}
        </p>
        <Button type="button" className="mt-6" onClick={reset}>
          {copy.dashboard.error.retry}
        </Button>
      </body>
    </html>
  );
}
