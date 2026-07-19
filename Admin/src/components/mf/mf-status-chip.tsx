"use client";

import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

export type MfStatusTone = "success" | "warning" | "danger" | "neutral";

function toneToVariant(tone: MfStatusTone): StatusBadgeVariant {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "danger") return "destructive";
  return "neutral";
}

export function MfStatusChip({
  label,
  tone = "neutral",
  showIcon = false,
}: {
  label: string;
  tone?: MfStatusTone;
  showIcon?: boolean;
}) {
  return (
    <StatusBadge variant={toneToVariant(tone)} showIcon={showIcon}>
      {label}
    </StatusBadge>
  );
}

export function lifecycleTone(status: string | null): MfStatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "warning";
  return "neutral";
}
