import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  className?: string;
};

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Badge variant={config.badgeVariant} className={cn(className)}>
      <Icon strokeWidth={2.25} />
      {children}
    </Badge>
  );
}
