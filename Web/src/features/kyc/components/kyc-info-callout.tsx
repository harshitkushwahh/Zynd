"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type KycInfoCalloutProps = {
  title?: string;
  description: ReactNode;
  className?: string;
  /** Icon + one line of text (no title stack). */
  layout?: "default" | "inline";
  /** Optional control aligned inside the callout (e.g. DigiLocker retry). */
  action?: ReactNode;
};

export function KycInfoCallout({
  title,
  description,
  className,
  layout = "default",
  action,
}: KycInfoCalloutProps) {
  const inline = layout === "inline";
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-[var(--radius-card)] border border-info/25 bg-gradient-to-br from-info/[0.07] via-card to-muted/15 px-4 shadow-zynd-low",
        inline ? "items-center py-3" : "items-start py-3.5",
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info/10 text-info ring-1 ring-inset ring-info/20">
        <Info className="size-4" strokeWidth={2.25} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 text-left leading-tight">
        {title && !inline ? (
          <p className="text-caption font-semibold tracking-tight text-foreground">{title}</p>
        ) : null}
        <div
          className={cn(
            inline
              ? "text-[11px] leading-snug text-muted-foreground"
              : "mt-1 space-y-1.5 text-[11px] leading-snug text-muted-foreground",
          )}
        >
          {description}
        </div>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
