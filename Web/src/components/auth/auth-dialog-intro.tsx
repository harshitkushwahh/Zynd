"use client";

import { AuthDialogShapeGrid } from "@/components/auth/auth-dialog-shape-grid";
import { AuthFormHeader, AuthProgress, type SignupStepId } from "@/components/auth/auth-shared";
import { useAuthDialogFlow } from "@/features/auth/hooks/auth-dialog-flow";

type AuthDialogIntroProps = {
  title: string;
  description: string;
  progressStep: SignupStepId | null;
  /** Tighter header for OTP steps so the form sits closer to the title. */
  compact?: boolean;
};

/** Logo + welcome copy over ShapeGrid background. */
export function AuthDialogIntro({ title, description, progressStep, compact = false }: AuthDialogIntroProps) {
  const { referralDialogOpen } = useAuthDialogFlow();

  return (
    <div
      className={
        compact
          ? "relative shrink-0 overflow-hidden border-b border-border/50 px-6 pb-3 pt-4 sm:px-8 sm:pb-4 sm:pt-5"
          : "relative shrink-0 overflow-hidden border-b border-border/50 px-6 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-6"
      }
    >
      <AuthDialogShapeGrid interactive={!referralDialogOpen} />
      <div className="pointer-events-none relative z-10">
        <AuthProgress currentStep={progressStep} compact={compact} />
        <AuthFormHeader title={title} description={description} compact={compact} />
      </div>
    </div>
  );
}
