"use client";

import { AlertCircle, CheckCircle2, Circle, ClipboardCheck } from "lucide-react";

import {
  DISTRIBUTOR_CLIENT_COPY,
  formatKycOverallStatus,
  kycProgressPct,
} from "@/lib/distributor-client-copy";
import type { DistributorClientKycStep } from "@/lib/dummy/types";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DISTRIBUTOR_STACK_MD_CLASS, DISTRIBUTOR_TEXT_MICRO_TABULAR_CLASS } from "@/lib/distributor-layout";

type ClientKycJourneyPanelProps = {
  steps: DistributorClientKycStep[];
  overallStatus: string;
  investorType?: string;
  className?: string;
};

function StepStatusIcon({ status }: { status: DistributorClientKycStep["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (status === "failed") {
    return <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />;
  }
  return <Circle className="size-5 shrink-0 text-muted-foreground/50" aria-hidden />;
}

function stepStatusLabel(
  status: DistributorClientKycStep["status"],
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"],
) {
  if (status === "completed") return copy.stepCompleted;
  if (status === "failed") return copy.stepNeedsAttention;
  return copy.stepPending;
}

export function ClientKycJourneyPanel({
  steps,
  overallStatus,
  investorType,
  className,
}: ClientKycJourneyPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const completed = steps.filter((step) => step.status === "completed").length;
  const percent = kycProgressPct(completed, steps.length);

  return (
    <div className={cn(DISTRIBUTOR_STACK_MD_CLASS, className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardCheck className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-compact font-semibold text-foreground">{copy.title}</p>
            <p className="mt-0.5 text-caption text-muted-foreground">
              {copy.overallLabel}: {formatKycOverallStatus(overallStatus)}
              {investorType ? ` · ${investorType}` : ""}
            </p>
          </div>
        </div>
        <p className="text-caption font-medium tabular-nums text-muted-foreground sm:text-right">
          {completed} of {steps.length} steps complete
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>Progress</span>
          <span className="font-medium tabular-nums text-foreground">{percent}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="KYC completion"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const completedStep = step.status === "completed";
          const failed = step.status === "failed";
          return (
            <li key={step.id}>
              <Card
                className={cn(
                  "flex h-full flex-col gap-2 border p-3 shadow-sm transition-colors",
                  completedStep && "border-emerald-500/25 bg-emerald-500/5",
                  failed && "border-destructive/30 bg-destructive/5",
                  !completedStep && !failed && "border-border bg-card",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={DISTRIBUTOR_TEXT_MICRO_TABULAR_CLASS}>
                    Step {index + 1}
                  </span>
                  <StepStatusIcon status={step.status} />
                </div>
                <p className="text-compact font-medium leading-snug text-foreground">{step.label}</p>
                <p
                  className={cn(
                    "text-caption",
                    completedStep && "text-emerald-700 dark:text-emerald-400",
                    failed && "text-destructive",
                    !completedStep && !failed && "text-muted-foreground",
                  )}
                >
                  {stepStatusLabel(step.status, copy)}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
