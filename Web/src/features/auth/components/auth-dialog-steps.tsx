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
import { cn } from "@/lib/utils";

export function AuthDialogSteps() {
  const { step, title, description, progressStep } = useAuthDialogHeader();
  const compactBody = step === "mobile-otp" || step === "email-otp";

  return (
    <div className="flex max-h-[min(90dvh,720px)] min-h-0 flex-col rounded-[inherit] bg-popover">
      <AuthDialogIntro
        title={title}
        description={description}
        progressStep={progressStep}
        compact={compactBody}
      />
      <div
        className={cn(
          "min-h-0 overflow-y-auto px-6 sm:px-8",
          compactBody ? "pb-6 pt-2 sm:pb-7 sm:pt-3" : "pb-7 pt-5 sm:pb-9 sm:pt-6",
        )}
      >
        <div className="grid w-full auto-rows-min [&>form]:col-start-1 [&>form]:row-start-1">
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
