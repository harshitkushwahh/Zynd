"use client";

import { PiggyBank, Target, TrendingUp, Wallet } from "lucide-react";

import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { formatInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type AdminUserGoalFundingMetricsProps = {
  targetAmountInr: number;
  declaredInr: number;
  contributedInr: number;
  remainingInr: number;
  className?: string;
};

export function AdminUserGoalFundingMetrics({
  targetAmountInr,
  declaredInr,
  contributedInr,
  remainingInr,
  className,
}: AdminUserGoalFundingMetricsProps) {
  return (
    <AdminMetricCardsGrid
      className={cn("admin-user-goal-funding-metrics sm:grid-cols-2", className)}
    >
      <AdminMetricCard
        label="Target"
        icon={Target}
        tone="default"
        accent
        value={formatInr(targetAmountInr)}
        hint="Goal amount"
      />
      <AdminMetricCard
        label="Declared savings"
        icon={PiggyBank}
        tone={declaredInr > 0 ? "success" : "muted"}
        value={formatInr(declaredInr)}
        hint="Existing savings"
      />
      <AdminMetricCard
        label="Contributions"
        icon={TrendingUp}
        tone={contributedInr > 0 ? "success" : "muted"}
        value={formatInr(contributedInr)}
        hint="Invested progress"
      />
      <AdminMetricCard
        label="Remaining"
        icon={Wallet}
        tone="warning"
        value={formatInr(remainingInr)}
        hint="Left to target"
      />
    </AdminMetricCardsGrid>
  );
}
