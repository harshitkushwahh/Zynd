"use client";

import type { ReactNode } from "react";

import { KycDialogCloseButton } from "@/features/kyc/components/kyc-dialog-close-button";
import { KycVisualPanel } from "@/features/kyc/components/kyc-visual-panel";
import type { KycJourneyStepId } from "@/features/kyc/lib/kyc-journey";
import { cn } from "@/lib/utils";

type KycDialogLayoutProps = {
  activeStepId?: KycJourneyStepId;
  onClose: () => void;
  children: ReactNode;
  hidePanelVisual?: boolean;
  className?: string;
};

export function KycDialogLayout({
  activeStepId,
  onClose,
  children,
  hidePanelVisual = false,
  className,
}: KycDialogLayoutProps) {
  return (
    <div className={cn("relative flex h-full min-h-0 flex-1", className)}>
      <KycDialogCloseButton onClose={onClose} />
      <div className="grid h-full min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <KycVisualPanel
          activeStepId={activeStepId}
          hidePanelVisual={hidePanelVisual}
          className="kyc-dialog-visual-panel"
        />
        <div className="kyc-dialog-form-panel relative flex h-full min-h-0 flex-col">
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
