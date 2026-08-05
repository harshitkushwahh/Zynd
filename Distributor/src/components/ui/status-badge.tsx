import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DISTRIBUTOR_SELECTION_BADGE_CLASS } from "@/lib/distributor-layout";

export type StatusBadgeVariant =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "neutral";

const variantConfig: Record<
  StatusBadgeVariant,
  { icon: LucideIcon; badgeVariant: StatusBadgeVariant }
> = {
  success: { icon: CheckCircle2, badgeVariant: "success" },
  warning: { icon: AlertTriangle, badgeVariant: "warning" },
  destructive: { icon: AlertCircle, badgeVariant: "destructive" },
  info: { icon: Info, badgeVariant: "info" },
  neutral: { icon: Circle, badgeVariant: "neutral" },
};

type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  /** Optional icon override (defaults to the variant icon). */
  icon?: LucideIcon;
};

/** Compact status chip with icon — single badge UI for the Distributor app. */
export function StatusBadge({ variant, children, icon }: StatusBadgeProps) {
  const config = variantConfig[variant];
  const Icon = icon ?? config.icon;

  return (
    <Badge variant={config.badgeVariant} className={DISTRIBUTOR_SELECTION_BADGE_CLASS}>
      <Icon strokeWidth={2.25} />
      {children}
    </Badge>
  );
}
