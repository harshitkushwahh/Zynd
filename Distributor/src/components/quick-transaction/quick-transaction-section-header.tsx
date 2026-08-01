"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type QuickTransactionSectionHeaderProps = {
  title: string;
  helpText: string;
  helpAriaLabel?: string;
  trailing?: ReactNode;
};

export function QuickTransactionSectionHeader({
  title,
  helpText,
  helpAriaLabel,
  trailing,
}: QuickTransactionSectionHeaderProps) {
  return (
    <div className="quick-txn-wizard__section-head">
      <h2 className="quick-txn-wizard__section-title">{title}</h2>
      <div className="quick-txn-wizard__section-head-aside">
        {trailing ? <div className="quick-txn-wizard__section-head-trailing">{trailing}</div> : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <DistributorActionButton
                type="button"
                variant="icon"
                className="quick-txn-wizard__section-help"
                aria-label={helpAriaLabel ?? `About ${title}`}
              >
                <Info className="size-4" strokeWidth={2.25} />
              </DistributorActionButton>
            }
          />
          <TooltipContent side="bottom" align="end" className="max-w-xs text-left leading-snug">
            {helpText}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
