"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AddInvestorWizardPanelShellProps = {
  title: string;
  meta?: ReactNode;
  progress?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AddInvestorWizardPanelShell({
  title,
  meta,
  progress,
  children,
  footer,
  className,
}: AddInvestorWizardPanelShellProps) {
  return (
    <div className={cn("quick-txn-wizard__section add-investor-wizard-panel", className)}>
      <div className="add-investor-wizard-panel__head">
        <h2 className="quick-txn-wizard__section-title">{title}</h2>
        {meta ? <div className="add-investor-wizard-panel__meta">{meta}</div> : null}
      </div>

      {progress}

      <div className="add-investor-wizard-panel__body">{children}</div>

      {footer ? (
        <div className="quick-txn-wizard__footer add-investor-wizard-panel__footer">{footer}</div>
      ) : null}
    </div>
  );
}
