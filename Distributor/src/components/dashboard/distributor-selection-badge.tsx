import { Badge } from "@/components/ui/badge";
import { DISTRIBUTOR_SELECTION_BADGE_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export type DistributorSelectionBadgeVariant = "selected" | "empty";

const variantStyles: Record<
  DistributorSelectionBadgeVariant,
  { badgeVariant: "secondary" | "outline" }
> = {
  selected: { badgeVariant: "secondary" },
  empty: { badgeVariant: "outline" },
};

type DistributorSelectionBadgeProps = {
  variant: DistributorSelectionBadgeVariant;
  children: React.ReactNode;
  className?: string;
};

export function DistributorSelectionBadge({
  variant,
  children,
  className,
}: DistributorSelectionBadgeProps) {
  const { badgeVariant } = variantStyles[variant];

  return (
    <Badge
      variant={badgeVariant}
      className={cn(DISTRIBUTOR_SELECTION_BADGE_CLASS, className)}
    >
      {children}
    </Badge>
  );
}
