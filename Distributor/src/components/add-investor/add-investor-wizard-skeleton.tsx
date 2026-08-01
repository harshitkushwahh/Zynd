"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { QuickTransactionSectionHeaderSkeleton } from "@/components/quick-transaction/quick-transaction-section-header-skeleton";
import type { AddInvestorStepId } from "@/lib/add-investor/add-investor-journey";
import { cn } from "@/lib/utils";

const JOURNEY_STEP_COUNT = 10;

function AddInvestorOnboardingPanelSkeleton() {
  return (
    <div className="add-investor-wizard-skeleton__onboarding">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-20 rounded-[var(--radius-full)]" />
        ))}
      </div>
      <Skeleton className="mt-6 h-5 w-32 rounded-[var(--radius-control)]" />
      <Skeleton className="mt-2 h-4 w-56 max-w-full rounded-[var(--radius-control)]" />
      <Skeleton className="mt-4 h-10 w-full rounded-[var(--radius-control)]" />
      <Skeleton className="mt-3 h-9 w-36 rounded-full" />
    </div>
  );
}

function AddInvestorFormPanelSkeleton({ fieldCount = 4 }: { fieldCount?: number }) {
  return (
    <div className="add-investor-wizard-skeleton__form">
      <QuickTransactionSectionHeaderSkeleton titleWidthClassName="w-40" />
      <div className="mt-4 space-y-4">
        {Array.from({ length: fieldCount }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3.5 w-24 rounded-[var(--radius-control)]" />
            <Skeleton className="h-10 w-full rounded-[var(--radius-control)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AddInvestorAddressPanelSkeleton() {
  return (
    <div className="add-investor-wizard-skeleton__address">
      <QuickTransactionSectionHeaderSkeleton titleWidthClassName="w-36" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3.5 w-20 rounded-[var(--radius-control)]" />
              <Skeleton className="h-10 w-full rounded-[var(--radius-control)]" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3.5 w-16 rounded-[var(--radius-control)]" />
              <Skeleton className="h-10 w-full rounded-[var(--radius-control)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddInvestorReviewPanelSkeleton() {
  return (
    <div className="add-investor-wizard-skeleton__review">
      <QuickTransactionSectionHeaderSkeleton
        titleWidthClassName="w-28"
        trailing={<Skeleton className="h-6 w-28 rounded-full" />}
      />
      <Skeleton className="mt-4 h-28 w-full rounded-[var(--radius-5xl)]" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-[var(--radius-5xl)]" />
        ))}
      </div>
    </div>
  );
}

function AddInvestorActionPanelSkeleton() {
  return (
    <div className="add-investor-wizard-skeleton__action">
      <QuickTransactionSectionHeaderSkeleton titleWidthClassName="w-44" />
      <Skeleton className="mt-6 h-32 w-full rounded-[var(--radius-5xl)]" />
      <Skeleton className="mt-4 h-10 w-44 rounded-full" />
    </div>
  );
}

function AddInvestorPanelSkeleton({ step }: { step: AddInvestorStepId }) {
  if (step === "onboarding") return <AddInvestorOnboardingPanelSkeleton />;
  if (step === "address") return <AddInvestorAddressPanelSkeleton />;
  if (step === "review") return <AddInvestorReviewPanelSkeleton />;
  if (step === "digilocker" || step === "esign" || step === "signature-upload") {
    return <AddInvestorActionPanelSkeleton />;
  }
  return <AddInvestorFormPanelSkeleton fieldCount={step === "bank" ? 5 : 4} />;
}

type AddInvestorWizardSkeletonProps = {
  className?: string;
  panelStep?: AddInvestorStepId;
  panelOnly?: boolean;
};

export function AddInvestorWizardSkeleton({
  className,
  panelStep = "onboarding",
  panelOnly = false,
}: AddInvestorWizardSkeletonProps) {
  if (panelOnly) {
    return (
      <div
        className={cn("quick-txn-wizard-skeleton quick-txn-wizard-skeleton--panel", className)}
        aria-busy="true"
      >
        <AddInvestorPanelSkeleton step={panelStep} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "quick-txn-wizard add-investor-wizard quick-txn-wizard--skeleton distributor-wizard-page--skeleton",
        className,
      )}
      aria-busy="true"
      aria-label="Loading add investor"
    >
      <div className="quick-txn-wizard__journey quick-txn-wizard-skeleton__journey">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-[var(--radius-control)]" />
            <Skeleton className="h-3.5 w-24 rounded-[var(--radius-control)]" />
          </div>
          <Skeleton className="h-5 w-10 rounded-[var(--radius-control)]" />
        </div>
        <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-3 w-20 rounded-[var(--radius-control)]" />
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
        <AddInvestorPanelSkeleton step={panelStep} />
        <div className="quick-txn-wizard__footer">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}
