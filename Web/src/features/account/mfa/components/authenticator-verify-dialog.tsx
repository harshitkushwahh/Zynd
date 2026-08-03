"use client";

import { StepUpDialog } from "@/features/account/mfa/components/step-up-dialog";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { copy } from "@/shared/config/copy";

type AuthenticatorVerifyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  loading?: boolean;
  error?: string;
  onErrorChange?: (message: string) => void;
  onSubmit: (verification: StepUpVerification) => void;
};

export function AuthenticatorVerifyDialog({
  title = "Verify authenticator",
  description = copy.auth.mfaAuthenticatorHint,
  ...props
}: AuthenticatorVerifyDialogProps) {
  return <StepUpDialog title={title} description={description} {...props} />;
}

export { StepUpDialog } from "@/features/account/mfa/components/step-up-dialog";
export type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
