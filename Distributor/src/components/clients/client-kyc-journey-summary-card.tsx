"use client";

import { BadgeCheck, CalendarDays, CheckCircle2, ClipboardCheck } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  isKycJourneyComplete,
  kycStepIcon,
  resolveKycLastActiveStep,
} from "@/lib/distributor-client-kyc-steps";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import type { DistributorClientKycStep } from "@/lib/distributor-types";
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

function formatJourneyStepMetric(
  journeyComplete: boolean,
  lastStep: DistributorClientKycStep | null,
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"],
): { label: string; value: string } {
  if (!lastStep) {
    return {
      value: copy.journeyLastStepUnknown,
      label: copy.journeyLastStepLabel,
    };
  }

  if (journeyComplete) {
    return {
      value: lastStep.label,
      label: `${copy.journeyLastStepLabel} · ${copy.stepCompleted}`,
    };
  }

  const status = lastStepStatusHint(lastStep, copy);
  return {
    value: lastStep.label,
    label:
      status === copy.stepPending
        ? copy.journeyLastStepLabel
        : `${copy.journeyLastStepLabel} · ${status}`,
  };
}

export function ClientKycJourneySummaryCard({
  steps,
  kycInitiatedAt,
  kycCompliant,
  className,
}: ClientKycJourneySummaryCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const journeyComplete = isKycJourneyComplete(steps);
  const lastStep = resolveKycLastActiveStep(steps);
  const { label: statusLabel, value: statusValue } = formatJourneyStepMetric(
    journeyComplete,
    lastStep,
    copy,
  );
  const statusIcon = journeyComplete ? CheckCircle2 : lastStep ? kycStepIcon(lastStep.id) : ClipboardCheck;

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
        tileTone={journeyComplete ? "success" : "default"}
        icon={statusIcon}
        label={statusLabel}
        value={statusValue}
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
        label={copy.journeyKraStatusLabel}
        value={kycCompliant ? copy.journeyKraRegisteredValue : copy.journeyKraNotRegisteredValue}
        showTileAction={false}
      />
    </div>
  );
}
