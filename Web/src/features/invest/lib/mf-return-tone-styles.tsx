import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

export type MfReturnTone = "positive" | "negative" | "muted";

export function mfReturnToneTextClass(tone: MfReturnTone) {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-[var(--zynd-accent-red)]",
    tone === "muted" && "text-muted-foreground",
  );
}

export function mfReturnTonePillClass(tone: MfReturnTone) {
  return cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
    tone === "positive" && "bg-success/12 text-success",
    tone === "negative" &&
      "bg-[color-mix(in_srgb,var(--zynd-accent-red)_14%,transparent)] text-[var(--zynd-accent-red)]",
    tone === "muted" && "bg-muted text-muted-foreground",
  );
}

export function MfReturnDirectionBadge({ tone }: { tone: MfReturnTone }) {
  if (tone === "positive") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-success text-white">
        <ArrowUp className="size-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  if (tone === "negative") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-[var(--zynd-accent-red)] text-white">
        <ArrowDown className="size-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  return null;
}
