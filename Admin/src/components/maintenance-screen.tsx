"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const MAINTENANCE_LOTTIE_SRC = "/maintenance/under-construction.lottie";

const COPY = {
  title: "We'll be right back",
  description:
    "ZYND Admin is updating or the API is restarting. This usually takes a few minutes during deploy.",
  checkStatus: "Fetch latest status",
  checking: "Checking status…",
  stillUpdating: "Still updating. Try again in a moment.",
  backOnline: "We're back. Reloading…",
};

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
      setMessage(COPY.backOnline);
      onBackOnline?.();
      return;
    }
    setMessage(COPY.stillUpdating);
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
          className="mt-6 font-heading text-2xl font-semibold text-foreground"
        >
          {COPY.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{COPY.description}</p>
        <Button className="mt-8" disabled={checking} onClick={() => void handleCheckStatus()}>
          {checking ? COPY.checking : COPY.checkStatus}
        </Button>
        {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
