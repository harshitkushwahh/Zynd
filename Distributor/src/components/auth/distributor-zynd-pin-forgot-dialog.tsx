"use client";

import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

import { DistributorPinInput } from "@/components/auth/distributor-pin-input";
import { OtpInput } from "@/components/auth/otp-input";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { useDistributorZyndPinOptional } from "@/contexts/distributor-zynd-pin-context";
import { ApiError } from "@/lib/api-client";
import { resetZyndPinWithOtp, sendZyndPinResetOtp } from "@/lib/distributor-pin-api";

type DistributorZyndPinForgotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DistributorZyndPinForgotDialog({
  open,
  onOpenChange,
}: DistributorZyndPinForgotDialogProps) {
  const { refreshUser } = useDistributorAuth();
  const pinContext = useDistributorZyndPinOptional();
  const [step, setStep] = useState<"send" | "reset">("send");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setStep("send");
    setOtp("");
    setPin("");
    setConfirmPin("");
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const handleSendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await sendZyndPinResetOtp();
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin !== confirmPin) {
      setError("PIN entries do not match.");
      return;
    }
    if (pin.length !== 4 || otp.length !== 6) {
      setError("Enter the email code and a 4-digit PIN.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await resetZyndPinWithOtp({ otp, pin, confirmPin });
      await refreshUser();
      pinContext?.markUnlocked();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset PIN.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
              <LockKeyhole className="size-5" />
            </div>
            <div>
              <DialogTitle>Reset PIN lock</DialogTitle>
              <DialogDescription>
                We will email you a verification code to set a new PIN.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          {step === "send" ? (
            <>
              {error ? <DistributorFeedbackMessage variant="error">{error}</DistributorFeedbackMessage> : null}
              <DistributorActionButton
                type="button"
                variant="primary"
                className="w-full"
                disabled={loading}
                onClick={() => void handleSendOtp()}
              >
                {loading ? "Sending…" : "Send reset code"}
              </DistributorActionButton>
            </>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <p className="text-caption font-medium text-foreground">Email verification code</p>
                <OtpInput value={otp} onChange={setOtp} error={!!error} />
              </div>
              <div className="space-y-2">
                <p className="text-center text-caption font-medium text-foreground">New PIN</p>
                <DistributorPinInput value={pin} onChange={setPin} error={!!error} />
              </div>
              <div className="space-y-2">
                <p className="text-center text-caption font-medium text-foreground">Confirm PIN</p>
                <DistributorPinInput
                  value={confirmPin}
                  onChange={setConfirmPin}
                  error={!!error || (confirmPin.length === 4 && pin !== confirmPin)}
                />
              </div>
              {error ? <DistributorFeedbackMessage variant="error">{error}</DistributorFeedbackMessage> : null}
              <DistributorActionButton
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading || otp.length !== 6 || pin.length !== 4 || confirmPin.length !== 4}
              >
                {loading ? "Saving…" : "Reset PIN"}
              </DistributorActionButton>
              <DistributorActionButton
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => void handleSendOtp()}
              >
                Resend code
              </DistributorActionButton>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
