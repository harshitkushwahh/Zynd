"use client";

import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

import { PinInput } from "@/features/account/pin/components/pin-input";
import {
  resetZyndPinWithOtp,
  sendZyndPinResetOtp,
} from "@/features/account/pin/api/pin-api";
import { Button } from "@/components/ui/button";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { OtpInput } from "@/components/auth/auth-shared";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { useZyndPinOptional } from "@/contexts/zynd-pin-context";
import { ApiError } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";
import { storageKeys } from "@/shared/config/storage-keys";
import { copy } from "@/shared/config/copy";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";

type ZyndPinForgotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ZyndPinForgotDialog({ open, onOpenChange }: ZyndPinForgotDialogProps) {
  const { refreshUser } = useAuth();
  const pinContext = useZyndPinOptional();
  const [step, setStep] = useState<"send" | "reset">("send");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cooldown = useOtpResendCooldown(storageKeys.pinResetOtpCooldown);

  const resetState = () => {
    setStep("send");
    setOtp("");
    setPin("");
    setConfirmPin("");
    setError("");
    setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const handleSendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await sendZyndPinResetOtp();
      cooldown.startCooldown(result.retry_after_seconds);
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.pin.couldNotReset);
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
    if (pin.length !== appConfig.pinLength) return;

    setLoading(true);
    setError("");
    try {
      await resetZyndPinWithOtp({ otp, pin, confirmPin });
      await refreshUser();
      pinContext?.markUnlocked();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.pin.couldNotReset);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.pin.forgotTitle}
      description={copy.pin.forgotDescription}
      icon={LockKeyhole}
      headerDensity="compact"
    >
      <div className="space-y-4 p-5">
          {step === "send" ? (
            <>
              <FieldMessage message={error} />
              <Button className="w-full" disabled={loading} onClick={() => void handleSendOtp()}>
                {loading ? copy.mfa.preparing : copy.pin.sendResetCode}
              </Button>
            </>
          ) : (
            <form className="space-y-4" onSubmit={handleReset}>
              <div>
                <label className="mb-2 block text-caption font-medium text-foreground">
                  Email verification code
                </label>
                <OtpInput value={otp} onChange={setOtp} />
              </div>

              <div>
                <p className="mb-2 text-center text-caption font-medium text-foreground">
                  {copy.pin.setupStepCreate}
                </p>
                <PinInput value={pin} onChange={setPin} />
              </div>

              <div>
                <p className="mb-2 text-center text-caption font-medium text-foreground">
                  {copy.pin.setupStepConfirm}
                </p>
                <PinInput value={confirmPin} onChange={setConfirmPin} />
              </div>

              <FieldMessage message={error} />

              <Button
                type="submit"
                className="w-full"
                disabled={
                  loading ||
                  otp.length !== appConfig.otpLength ||
                  pin.length !== appConfig.pinLength ||
                  confirmPin.length !== appConfig.pinLength
                }
              >
                {loading ? copy.mfa.verifying : copy.pin.resetButton}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={!cooldown.canResend || loading}
                onClick={() => void handleSendOtp()}
              >
                {cooldown.canResend
                  ? copy.pin.sendResetCode
                  : `Resend in ${cooldown.secondsLeft}s`}
              </Button>
            </form>
          )}
        </div>
    </BrandDialog>
  );
}
