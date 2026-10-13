"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Check, Smartphone, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type OtpDeliveryVisualState = "idle" | "error" | "success";

type OtpDeliveryConnectorProps = {
  state?: OtpDeliveryVisualState;
  className?: string;
};

const STATE_RING: Record<OtpDeliveryVisualState, string> = {
  idle: "border-border/70 bg-muted/25 text-primary",
  error: "border-destructive/50 bg-destructive/10 text-destructive",
  success: "border-success/45 bg-success/10 text-success",
};

function DottedBridge({ state }: { state: OtpDeliveryVisualState }) {
  const dot =
    state === "error"
      ? "bg-destructive/45"
      : state === "success"
        ? "bg-success/50"
        : "bg-muted-foreground/35";

  return (
    <div className="flex w-[4.5rem] shrink-0 items-center justify-center gap-1 px-0.5 sm:w-[5.25rem]" aria-hidden>
      {Array.from({ length: 7 }, (_, index) => (
        <span key={index} className={cn("size-1 rounded-full", dot)} />
      ))}
    </div>
  );
}

function EndpointBadge({
  state,
  children,
  statusIcon,
}: {
  state: OtpDeliveryVisualState;
  children: ReactNode;
  statusIcon?: "check" | "x" | null;
}) {
  return (
    <span className="relative flex shrink-0">
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full border-2 transition-colors duration-200 sm:size-12",
          STATE_RING[state],
        )}
      >
        {children}
      </span>
      {statusIcon ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex size-[1.125rem] items-center justify-center rounded-full border-2 border-card",
            statusIcon === "check" ? "bg-success text-success-foreground" : "bg-destructive text-white",
          )}
        >
          {statusIcon === "check" ? (
            <Check className="size-2.5" strokeWidth={3} aria-hidden />
          ) : (
            <X className="size-2.5" strokeWidth={3} aria-hidden />
          )}
        </span>
      ) : null}
    </span>
  );
}

export function OtpDeliveryConnector({ state = "idle", className }: OtpDeliveryConnectorProps) {
  const statusIcon = state === "error" ? "x" : state === "success" ? "check" : null;

  return (
    <div className={cn("mx-auto flex items-center justify-center py-2", className)} aria-hidden>
      <EndpointBadge state={state} statusIcon={statusIcon}>
        <Image
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className={cn(
            "size-7 object-contain transition-opacity sm:size-8",
            state === "error" && "opacity-80",
          )}
        />
      </EndpointBadge>
      <DottedBridge state={state} />
      <EndpointBadge state={state} statusIcon={statusIcon}>
        <Smartphone className="size-5 sm:size-[1.35rem]" strokeWidth={2} aria-hidden />
      </EndpointBadge>
    </div>
  );
}
