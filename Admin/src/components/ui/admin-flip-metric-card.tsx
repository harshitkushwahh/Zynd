"use client";

import {
  AdminMetricCard,
  type AdminMetricCardFace,
} from "@/components/ui/admin-metric-card";

export type AdminFlipMetricFace = AdminMetricCardFace;

type AdminFlipMetricCardProps = {
  front: AdminFlipMetricFace;
  back: AdminFlipMetricFace;
  className?: string;
  defaultFlipped?: boolean;
  loading?: boolean;
};

/** @deprecated Prefer `AdminMetricCard` with `variant="flip"`. */
export function AdminFlipMetricCard({
  front,
  back,
  className,
  defaultFlipped = false,
  loading = false,
}: AdminFlipMetricCardProps) {
  return (
    <AdminMetricCard
      variant="flip"
      label={front.label}
      value={front.value}
      hint={front.hint}
      icon={front.icon}
      back={back}
      className={className}
      defaultFlipped={defaultFlipped}
      loading={loading}
    />
  );
}
