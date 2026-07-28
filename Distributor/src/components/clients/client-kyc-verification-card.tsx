"use client";

import { useState } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import { ClientKycJourneyDialog } from "@/components/clients/client-kyc-journey-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DISTRIBUTOR_CLIENT_COPY, kycProgressPct } from "@/lib/distributor-client-copy";
import type { DistributorClientKycStep } from "@/lib/dummy/types";
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
  className?: string;
  variant?: "default" | "inline";
};

export function ClientKycVerificationCard({
  steps,
  overallStatus,
  investorType,
  className,
  variant = "default",
}: ClientKycVerificationCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const completed = steps.filter((step) => step.status === "completed").length;
  const percent = kycProgressPct(completed, steps.length);
  const allComplete = completed === steps.length && steps.length > 0;
  const [dialogOpen, setDialogOpen] = useState(false);
  const inline = variant === "inline";

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
          onClick={() => setDialogOpen(true)}
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
            {completed}/{steps.length} steps
          </p>
        </div>
      </Card>

      <ClientKycJourneyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        steps={steps}
        overallStatus={overallStatus}
        investorType={investorType}
      />
    </>
  );
}
