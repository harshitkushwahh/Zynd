"use client";

import { useState } from "react";
import { ArrowUpRight, CheckCircle2, ClipboardCheck } from "lucide-react";

import { ClientKycJourneyDialog } from "@/components/clients/client-kyc-journey-dialog";
import { useClientDetailTabNavigation } from "@/components/clients/client-detail-tab-navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { summarizeKycProgress } from "@/lib/distributor-client-kyc-steps";
import type { DistributorClientKycStep } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";
import {
  DISTRIBUTOR_LABEL_CAPS_INLINE_END_CLASS,
  DISTRIBUTOR_RISK_CARD_INLINE_CLASS,
  DISTRIBUTOR_TEXT_MICRO_TIGHT_CLASS,
} from "@/lib/distributor-layout";

type ClientKycVerificationCardProps = {
  steps: DistributorClientKycStep[];
  overallStatus: string;
  investorType?: string;
  kycCompliant?: boolean;
  className?: string;
  variant?: "default" | "inline" | "sidebar";
};

export function ClientKycVerificationCard({
  steps,
  overallStatus,
  investorType,
  kycCompliant = false,
  className,
  variant = "default",
}: ClientKycVerificationCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const { completed, total, percent } = summarizeKycProgress(steps);
  const allComplete = completed === total && total > 0;
  const tabNavigation = useClientDetailTabNavigation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const inline = variant === "inline";

  const openKycDetail = () => {
    if (tabNavigation) {
      tabNavigation.navigateToTab("kyc");
      return;
    }
    setDialogOpen(true);
  };

  if (variant === "sidebar") {
    return (
      <article className={cn("distributor-client-kyc-sidebar-card", className)}>
        <button
          type="button"
          className="distributor-client-kyc-sidebar-card__main"
          onClick={openKycDetail}
          aria-label={`${copy.title}, ${percent} percent complete. Open KYC tab.`}
        >
            <div
              className={cn(
                "distributor-client-kyc-sidebar-card__icon",
                allComplete && "distributor-client-kyc-sidebar-card__icon--complete",
              )}
              aria-hidden
            >
              <ClipboardCheck className="size-5" strokeWidth={2.25} />
            </div>
            <div className="distributor-client-kyc-sidebar-card__body">
              <div className="distributor-client-kyc-sidebar-card__head">
                <p className="distributor-client-kyc-sidebar-card__title">{copy.title.toUpperCase()}</p>
                <div className="distributor-client-kyc-sidebar-card__stats">
                  <span className="distributor-client-kyc-sidebar-card__percent tabular-nums">
                    {percent}%
                  </span>
                </div>
              </div>
              <div
                className="distributor-client-kyc-sidebar-card__progress"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${copy.title} ${percent}%`}
              >
                <div
                  className="distributor-client-kyc-sidebar-card__progress-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </button>
      </article>
    );
  }

  return (
    <>
      <Card
        className={cn(
          "relative flex flex-col border-border bg-card shadow-sm",
          inline ? DISTRIBUTOR_RISK_CARD_INLINE_CLASS : "p-4",
          className,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1 right-1 size-6 text-muted-foreground hover:text-foreground"
          onClick={openKycDetail}
          aria-label="View KYC detail"
        >
          <ArrowUpRight className="size-3.5" />
        </Button>
        <p className={DISTRIBUTOR_LABEL_CAPS_INLINE_END_CLASS}>
          {copy.title}
        </p>
        <div
          className={cn(
            "flex flex-col items-center justify-center text-center",
            inline ? "mt-2 gap-1 py-1" : "mt-3 flex-1 gap-2 py-2",
          )}
        >
          <CheckCircle2
            className={cn(
              inline ? "size-9" : "size-11",
              allComplete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/45",
            )}
            aria-hidden
          />
          <p className="text-compact font-semibold tabular-nums text-foreground">{percent}%</p>
          <p className={cn("text-muted-foreground", inline ? DISTRIBUTOR_TEXT_MICRO_TIGHT_CLASS : "text-caption")}>
            {completed}/{total} steps
          </p>
        </div>
      </Card>

      {!tabNavigation ? (
        <ClientKycJourneyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          steps={steps}
          overallStatus={overallStatus}
          investorType={investorType}
          kycCompliant={kycCompliant}
        />
      ) : null}
    </>
  );
}
