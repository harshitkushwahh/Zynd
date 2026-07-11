"use client";

import { Clock } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type KycStatusRingProps = {
  children: ReactNode;
  tone: "warning" | "success" | null;
  showWatch?: boolean;
  className?: string;
};

function StatusRingSvg({ tone }: { tone: "warning" | "success" }) {
  const stroke = tone === "success" ? "var(--success)" : "var(--warning)";

  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      aria-hidden
    >
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeDasharray="5 11"
        strokeLinecap="round"
        className={tone === "success" ? "opacity-40" : "opacity-55"}
      />
    </svg>
  );
}

export function KycStatusRing({
  children,
  tone,
  showWatch = false,
  className,
}: KycStatusRingProps) {
  if (!tone) {
    return <>{children}</>;
  }

  const isSuccess = tone === "success";

  return (
    <div className={cn("group/kyc-ring relative inline-flex", className)}>
      <div
        className={cn(
          "relative rounded-full bg-transparent p-1.5 transition-shadow duration-300",
          isSuccess && "group-hover/kyc-ring:kyc-status-ring-glow-success"
        )}
      >
        <div className="relative rounded-full bg-transparent [&_[data-slot=avatar]]:bg-transparent [&_[data-slot=avatar]]:after:hidden">
          {children}
        </div>

        <StatusRingSvg tone={tone} />
      </div>

      {showWatch ? (
        <span
          className={cn(
            "pointer-events-none absolute bottom-0 left-1/2 flex size-5 -translate-x-1/2 translate-y-1/3 items-center justify-center rounded-full border-2 border-card bg-card",
            isSuccess ? "text-success" : "text-warning"
          )}
          aria-hidden
        >
          <Clock className="size-2.5" strokeWidth={2.5} />
        </span>
      ) : null}
    </div>
  );
}
