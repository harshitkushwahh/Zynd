import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DistributorHeadStatusTone = "success" | "warning" | "destructive" | "neutral";

const STATUS_TONE_CLASS: Record<DistributorHeadStatusTone, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted/40 text-muted-foreground",
};

export function distributorHeadStatusTone(status: string): DistributorHeadStatusTone {
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "approved") return "success";
  if (
    normalized === "pending" ||
    normalized === "on leave" ||
    normalized === "onboarding"
  ) {
    return "warning";
  }
  if (normalized === "rejected" || normalized === "suspended") return "destructive";
  if (normalized === "on track" || normalized === "achieved") return "success";
  if (normalized === "at risk") return "warning";
  return "neutral";
}

export function DistributorHeadStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = distributorHeadStatusTone(status);
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", STATUS_TONE_CLASS[tone], className)}
    >
      {status}
    </Badge>
  );
}

export function DistributorHeadStepBadge({
  step,
  className,
}: {
  step: number | string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "size-7 shrink-0 rounded-full border-primary/50 bg-primary/10 p-0 text-micro font-semibold text-primary",
        className,
      )}
    >
      {step}
    </Badge>
  );
}

export function DistributorHeadChipBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("h-auto gap-1 font-normal text-micro", className)}>
      {children}
    </Badge>
  );
}
