"use client";

import { AuthReferralCodeDialog } from "@/features/auth/components/auth-referral-code-dialog";
import { useAuthDialogFlow } from "@/features/auth/hooks/auth-dialog-flow";

/** Referral modal as a sibling of the auth dialog (not inside its content tree). */
export function AuthReferralCodeDialogHost() {
  const {
    step,
    isLoginMode,
    appliedReferralCode,
    referralDialogOpen,
    setReferralDialogOpen,
    applyReferralCode,
  } = useAuthDialogFlow();

  if (step !== "email") {
    return null;
  }

  return (
    <AuthReferralCodeDialog
      open={referralDialogOpen}
      onOpenChange={setReferralDialogOpen}
      initialCode={appliedReferralCode ?? ""}
      isLoginMode={isLoginMode}
      onApply={applyReferralCode}
    />
  );
}
