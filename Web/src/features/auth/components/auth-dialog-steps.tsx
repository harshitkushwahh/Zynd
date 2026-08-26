"use client";

import {
  AuthBrandPanel,
  AuthFormHeader,
  AuthProgress,
} from "@/components/auth/auth-shared";
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
    <>
      <div className="grid min-h-[520px] grid-cols-1 md:grid-cols-[88fr_112fr]">
        <AuthBrandPanel />
        <div className="flex min-h-0 flex-col bg-popover p-6 sm:p-8">
          <AuthProgress currentStep={progressStep} />
          <AuthFormHeader title={title} description={description} />
          <div className="relative flex flex-1 flex-col overflow-hidden">
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
    </>
  );
}
