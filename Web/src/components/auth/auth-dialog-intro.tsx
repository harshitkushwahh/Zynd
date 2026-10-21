"use client";

import { AuthDialogShapeGrid } from "@/components/auth/auth-dialog-shape-grid";
import { AuthFormHeader, AuthProgress, type SignupStepId } from "@/components/auth/auth-shared";
import { useAuthDialogFlow } from "@/features/auth/hooks/auth-dialog-flow";

type AuthDialogIntroProps = {
  title: string;
  description: string;
  progressStep: SignupStepId | null;
};

/** Logo + welcome copy over ShapeGrid background. */
export function AuthDialogIntro({ title, description, progressStep }: AuthDialogIntroProps) {
  const { referralDialogOpen } = useAuthDialogFlow();

  return (
    <div className="relative shrink-0 overflow-hidden border-b border-border/50 px-6 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
      <AuthDialogShapeGrid interactive={!referralDialogOpen} />
      <div className="pointer-events-none relative z-10">
        <AuthProgress currentStep={progressStep} />
        <AuthFormHeader title={title} description={description} />
      </div>
    </div>
  );
}
