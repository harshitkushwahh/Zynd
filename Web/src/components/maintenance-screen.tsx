"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export const MAINTENANCE_LOTTIE_SRC = "/maintenance/under-construction.lottie";

const MAINTENANCE_LOTTIE_CLASS =
  "mx-auto h-56 w-full max-w-[280px] sm:h-64 sm:max-w-[320px]";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function MaintenanceLottie() {
  const [data, setData] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(MAINTENANCE_LOTTIE_SRC, { signal: controller.signal })
      .then(async (response) => (response.ok ? response.arrayBuffer() : null))
      .then((buffer) => {
        if (buffer && !controller.signal.aborted) setData(buffer);
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
      });
    return () => controller.abort();
  }, []);

  if (!data) return <div className={MAINTENANCE_LOTTIE_CLASS} aria-hidden />;

  return <DotLottieReact data={data} loop autoplay className={MAINTENANCE_LOTTIE_CLASS} />;
}

type MaintenanceScreenProps = {
  className?: string;
  onBackOnline?: () => void;
};

export async function fetchBackendHealthOk(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/health`, { cache: "no-store" });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

export function MaintenanceScreen({ className, onBackOnline }: MaintenanceScreenProps) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const handleCheckStatus = async () => {
    setChecking(true);
    setMessage("");
    const ok = await fetchBackendHealthOk();
    setChecking(false);
    if (ok) {
      setMessage(copy.backendConnection.backOnline);
      onBackOnline?.();
      return;
    }
    setMessage(copy.backendConnection.stillUpdating);
  };

  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col items-center justify-center bg-background px-6 py-12",
        className,
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <MaintenanceLottie />
        <h1
          id="zynd-maintenance-title"
          className="mt-6 font-heading text-title font-semibold text-foreground"
        >
          {copy.backendConnection.title}
        </h1>
        <p className="mt-3 text-body leading-relaxed text-muted-foreground">
          {copy.backendConnection.description}
        </p>
        <Button className="mt-8" disabled={checking} onClick={() => void handleCheckStatus()}>
          {checking ? copy.backendConnection.checking : copy.backendConnection.checkStatus}
        </Button>
        {message ? <p className="mt-3 text-caption text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
