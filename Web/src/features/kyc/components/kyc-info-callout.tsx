"use client";

import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type KycInfoCalloutProps = {
  title: string;
  description: string;
  className?: string;
};

export function KycInfoCallout({ title, description, className }: KycInfoCalloutProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-card)] border border-info/25 bg-gradient-to-br from-info/[0.07] via-card to-muted/15 px-4 py-3.5 shadow-zynd-low",
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info/10 text-info ring-1 ring-inset ring-info/20">
        <Info className="size-4" strokeWidth={2.25} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 text-left leading-tight">
        <p className="text-caption font-semibold tracking-tight text-foreground">{title}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
