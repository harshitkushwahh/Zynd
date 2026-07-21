"use client";

import {
  Car,
  GraduationCap,
  Heart,
  Home,
  Plane,
  Sunset,
  Target,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Goal } from "@/features/goals/api/goals-api";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  car: Car,
  plane: Plane,
  "graduation-cap": GraduationCap,
  heart: Heart,
  home: Home,
  sunset: Sunset,
  target: Target,
};

type GoalProgressCardProps = {
  goal: Goal;
  onSelect?: (goal: Goal) => void;
  selected?: boolean;
};

export function GoalProgressCard({ goal, onSelect, selected = false }: GoalProgressCardProps) {
  const iconKey = goal.template?.icon_key ?? "target";
  const Icon = TEMPLATE_ICONS[iconKey] ?? Target;
  const priorityLabel = copy.goals.priorityOptions[goal.priority as 1 | 2 | 3 | 4 | 5] ?? "Medium";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:border-primary/40",
        selected && "border-primary ring-1 ring-primary/30",
      )}
      onClick={() => onSelect?.(goal)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{goal.title}</CardTitle>
            <p className="text-compact text-muted-foreground">
              Target {formatInr(goal.target_amount_inr, { compact: true })} ·{" "}
              {new Date(goal.target_date).toLocaleDateString("en-IN", {
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="secondary">{copy.goals.status[goal.status]}</Badge>
          {goal.tag ? <Badge variant="outline">{goal.tag}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-compact">
            <span className="text-muted-foreground">{copy.goals.progressLabel}</span>
            <span className="font-medium">{goal.progress_pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(goal.progress_pct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-compact text-muted-foreground">
            <span>{formatInr(goal.current_amount_inr, { compact: true })} saved</span>
            <span>{priorityLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
