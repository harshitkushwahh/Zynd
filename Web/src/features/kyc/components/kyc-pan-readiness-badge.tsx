"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  getPanReadinessBadge,
  type KycReadinessInfo,
} from "@/features/kyc/lib/kyc-pan-readiness";

type KycPanReadinessBadgeProps = {
  readiness: KycReadinessInfo | null | undefined;
};

export function KycPanReadinessBadge({ readiness }: KycPanReadinessBadgeProps) {
  const config = getPanReadinessBadge(readiness);
  if (!config) return null;

  return (
    <StatusBadge variant={config.variant} className="h-6 px-2.5 text-[11px]">
      {config.label}
    </StatusBadge>
  );
}
