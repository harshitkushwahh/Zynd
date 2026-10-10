"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export const MAINTENANCE_LOTTIE_SRC = "/maintenance/under-construction.lottie";

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
        <DotLottieReact
          src={MAINTENANCE_LOTTIE_SRC}
          loop
          autoplay
          className="mx-auto h-56 w-full max-w-[280px] sm:h-64 sm:max-w-[320px]"
        />
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
