import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DistributorMetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  className?: string;
};

export function DistributorMetricCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  className,
}: DistributorMetricCardProps) {
  const content = (
    <CardContent className="distributor-metric-card__body">
      <span className="distributor-page-icon distributor-page-icon--sm" aria-hidden>
        <Icon strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-caption font-medium text-muted-foreground">{label}</span>
        <span className="distributor-metric-card__value">{value}</span>
        {hint ? <span className="distributor-metric-card__hint">{hint}</span> : null}
      </span>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className={cn("block min-w-0", className)}>
        <Card className="h-full transition-colors hover:bg-muted/25">{content}</Card>
      </Link>
    );
  }

  return (
    <Card className={cn("h-full shadow-sm", className)}>
      {content}
    </Card>
  );
}
