"use client";

import type { LucideIcon } from "lucide-react";

import { AdminInfoDialogTrigger } from "@/components/ui/admin-dialog-presets";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type AdminMetricCardTone = "default" | "success" | "warning" | "info" | "muted";

type AdminMetricCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  infoDescription?: string;
  infoDetails?: string[];
  icon: LucideIcon;
  tone?: AdminMetricCardTone;
  loading?: boolean;
  className?: string;
};

function iconToneClass(tone: AdminMetricCardTone) {
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "warning") return "bg-warning/10 text-warning";
  if (tone === "info") return "bg-primary/10 text-primary";
  if (tone === "muted") return "bg-muted/40 text-muted-foreground";
  return "bg-muted/50 text-muted-foreground";
}

export function AdminMetricCard({
  label,
  value,
  hint,
  infoDescription,
  infoDetails,
  icon: Icon,
  tone = "default",
  loading = false,
  className,
}: AdminMetricCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="flex gap-3 p-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            iconToneClass(tone),
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-caption text-muted-foreground">{label}</p>
            {infoDescription ? (
              <AdminInfoDialogTrigger
                title={label}
                description={infoDescription}
                details={infoDetails}
                buttonClassName="size-6"
              />
            ) : null}
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-16" />
          ) : (
            <p className="mt-1 font-heading text-h4 font-semibold tabular-nums text-foreground">{value}</p>
          )}
          {hint ? (
            <p className="mt-1 text-caption leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
