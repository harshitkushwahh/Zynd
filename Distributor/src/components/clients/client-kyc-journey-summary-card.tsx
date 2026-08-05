"use client";

import { BadgeCheck, CalendarDays, ClipboardCheck } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  kycStepIcon,
  resolveKycLastActiveStep,
} from "@/lib/distributor-client-kyc-steps";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import type { DistributorClientKycStep } from "@/lib/dummy/types";
import { formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClientKycJourneySummaryCardProps = {
  steps: DistributorClientKycStep[];
  kycInitiatedAt: string;
  kycCompliant: boolean;
  className?: string;
};

function lastStepStatusHint(
  step: DistributorClientKycStep,
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"],
): string {
  if (step.status === "not_applicable") return copy.stepNotRequired;
  if (step.status === "completed") return copy.stepCompleted;
  if (step.status === "failed") return copy.stepNeedsAttention;
  return copy.stepPending;
}

export function ClientKycJourneySummaryCard({
  steps,
  kycInitiatedAt,
  kycCompliant,
  className,
}: ClientKycJourneySummaryCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const lastStep = resolveKycLastActiveStep(steps);
  const LastStepIcon = lastStep ? kycStepIcon(lastStep.id) : ClipboardCheck;

  return (
    <div
      className={cn(
        DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
        DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
        "distributor-client-kyc-journey__status-metrics",
        className,
      )}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={LastStepIcon}
        label={copy.journeyLastStepLabel}
        value={lastStep?.label ?? copy.journeyLastStepUnknown}
        hint={lastStep ? lastStepStatusHint(lastStep, copy) : copy.stepPending}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={cn(
          DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
          "distributor-client-kyc-journey__status-metrics-date",
        )}
        variant="tile"
        icon={CalendarDays}
        label={copy.journeyInitiatedLabel}
        value={formatDistributorDate(kycInitiatedAt)}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={BadgeCheck}
        label={copy.journeyKraComplianceLabel}
        value={kycCompliant ? copy.journeyKraCompliant : copy.journeyKraNonCompliant}
        hint={kycCompliant ? copy.badgeKraCompliant : copy.badgeNewToKyc}
        showTileAction={false}
      />
    </div>
  );
}
