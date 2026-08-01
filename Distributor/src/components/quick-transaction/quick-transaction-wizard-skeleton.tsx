"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { QuickTransactionSectionHeaderSkeleton } from "@/components/quick-transaction/quick-transaction-section-header-skeleton";
import type { QuickTransactionWizardStepId } from "@/components/quick-transaction/quick-transaction-wizard-types";
import { cn } from "@/lib/utils";

const JOURNEY_STEP_COUNT = 5;

function QuickTransactionTypeStepSkeleton() {
  return (
    <div className="quick-txn-wizard-skeleton__type">
      <QuickTransactionSectionHeaderSkeleton titleWidthClassName="w-44" />
      <div className="quick-txn-wizard-skeleton__type-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="quick-txn-wizard-skeleton__type-card rounded-[var(--radius-5xl)]" />
        ))}
      </div>
    </div>
  );
}

function QuickTransactionTableStepSkeleton({ rowCount = 5 }: { rowCount?: number }) {
  return (
    <div className="quick-txn-wizard-skeleton__table">
      <QuickTransactionSectionHeaderSkeleton
        titleWidthClassName="w-36"
        trailing={<Skeleton className="h-8 w-40 rounded-full" />}
      />
      <Skeleton className="h-9 w-full rounded-[var(--radius-control)]" />
      <div className="quick-txn-wizard-skeleton__table-card">
        <Skeleton className="h-9 w-full rounded-none" />
        {Array.from({ length: rowCount }, (_, index) => (
          <div key={index} className="quick-txn-wizard-skeleton__table-row">
            <Skeleton className="h-4 w-[38%] max-w-[10rem]" />
            <Skeleton className="h-4 w-[24%] max-w-[7rem]" />
            <Skeleton className="hidden h-4 w-[18%] max-w-[5rem] sm:block" />
            <Skeleton className="hidden h-6 w-16 rounded-full md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickTransactionAmountStepSkeleton() {
  return (
    <div className="quick-txn-wizard-skeleton__amount">
      <QuickTransactionSectionHeaderSkeleton titleWidthClassName="w-40" />
      <Skeleton className="mt-2 h-24 w-full rounded-[var(--radius-5xl)]" />
      <Skeleton className="mt-4 h-16 w-full rounded-[var(--radius-5xl)]" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-[3.25rem] w-28 rounded-[var(--radius-5xl)]" />
        <Skeleton className="h-[3.25rem] w-36 rounded-[var(--radius-5xl)]" />
      </div>
    </div>
  );
}

function QuickTransactionReviewStepSkeleton() {
  return (
    <div className="quick-txn-wizard-skeleton__review">
      <QuickTransactionSectionHeaderSkeleton
        titleWidthClassName="w-28"
        trailing={<Skeleton className="h-6 w-28 rounded-full" />}
      />
      <Skeleton className="mt-2 h-28 w-full rounded-[var(--radius-5xl)]" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-[var(--radius-5xl)]" />
        <Skeleton className="h-24 rounded-[var(--radius-5xl)]" />
      </div>
      <Skeleton className="mt-4 h-20 w-full rounded-[var(--radius-5xl)]" />
    </div>
  );
}

function QuickTransactionPanelSkeleton({ step }: { step: QuickTransactionWizardStepId }) {
  if (step === "type") return <QuickTransactionTypeStepSkeleton />;
  if (step === "investors" || step === "funds") return <QuickTransactionTableStepSkeleton rowCount={4} />;
  if (step === "amount") return <QuickTransactionAmountStepSkeleton />;
  return <QuickTransactionReviewStepSkeleton />;
}

type QuickTransactionWizardSkeletonProps = {
  className?: string;
  panelStep?: QuickTransactionWizardStepId;
  panelOnly?: boolean;
};

export function QuickTransactionWizardSkeleton({
  className,
  panelStep = "type",
  panelOnly = false,
}: QuickTransactionWizardSkeletonProps) {
  if (panelOnly) {
    return (
      <div className={cn("quick-txn-wizard-skeleton quick-txn-wizard-skeleton--panel", className)} aria-busy="true">
        <QuickTransactionPanelSkeleton step={panelStep} />
      </div>
    );
  }

  return (
    <div className={cn("quick-txn-wizard quick-txn-wizard--skeleton distributor-wizard-page--skeleton", className)} aria-busy="true" aria-label="Loading quick transaction">
      <div className="quick-txn-wizard__journey quick-txn-wizard-skeleton__journey">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-[var(--radius-control)]" />
            <Skeleton className="h-3.5 w-20 rounded-[var(--radius-control)]" />
          </div>
          <Skeleton className="h-5 w-10 rounded-[var(--radius-control)]" />
        </div>
        <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: JOURNEY_STEP_COUNT }, (_, index) => (
            <div key={index} className="flex items-start gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2 pb-2">
                <Skeleton className="h-4 w-[70%] max-w-[9rem] rounded-[var(--radius-control)]" />
                <Skeleton className="h-3 w-[55%] max-w-[7rem] rounded-[var(--radius-control)]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="quick-txn-wizard__panel quick-txn-wizard-skeleton__panel">
        <QuickTransactionPanelSkeleton step={panelStep} />
        <div className="quick-txn-wizard__footer">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}
