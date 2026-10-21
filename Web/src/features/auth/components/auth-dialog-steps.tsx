"use client";

import { AuthDialogIntro } from "@/components/auth/auth-dialog-intro";
import { AuthEmailStep } from "@/features/auth/components/steps/auth-email-step";
import {
  AuthEmailOtpStep,
  AuthMobileOtpStep,
  AuthMobileStep,
  AuthPasswordStep,
  AuthProfileStep,
} from "@/features/auth/components/steps/auth-signup-steps";
import {
  AuthForgotPasswordStep,
  AuthMfaChallengeStep,
  AuthOAuthLinkStep,
  AuthSmsOtpLoginStep,
} from "@/features/auth/components/steps/auth-security-steps";
import { useAuthDialogHeader } from "@/features/auth/hooks/auth-dialog-flow";

export function AuthDialogSteps() {
  const { title, description, progressStep } = useAuthDialogHeader();

  return (
    <div className="flex max-h-[min(90dvh,720px)] min-h-0 flex-col rounded-[inherit] bg-popover">
      <AuthDialogIntro title={title} description={description} progressStep={progressStep} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-7 pt-5 sm:px-8 sm:pb-9 sm:pt-6">
        <div className="relative flex flex-1 flex-col">
          <AuthEmailStep />
          <AuthMfaChallengeStep />
          <AuthSmsOtpLoginStep />
          <AuthOAuthLinkStep />
          <AuthEmailOtpStep />
          <AuthPasswordStep />
          <AuthMobileStep />
          <AuthMobileOtpStep />
          <AuthProfileStep />
          <AuthForgotPasswordStep />
        </div>
      </div>
    </div>
  );
}
