"use client";

import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { OtpInput } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { AdminPinInput } from "@/components/settings/admin-pin-input";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminFormDialog } from "@/components/ui/admin-dialog-presets";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useAdminZyndPinOptional } from "@/contexts/admin-zynd-pin-context";
import { isValidOtp, isValidPassword } from "@/lib/admin-validation";
import {
  resetZyndPinWithOtp,
  sendZyndPinResetOtp,
  setupZyndPin,
} from "@/lib/pin-api";


export function AdminZyndPinSettingsSection() {
  const { user, refreshUser } = useAdminAuth();
  const pinContext = useAdminZyndPinOptional();
  const [setupOpen, setSetupOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [setupStep, setSetupStep] = useState<"verify" | "pin">("verify");
  const [currentPassword, setCurrentPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [forgotStep, setForgotStep] = useState<"send" | "reset">("send");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [resetConfirmPin, setResetConfirmPin] = useState("");

  const mfaEnabled = Boolean(user?.mfa_enrolled);
  const pinEnrolled = Boolean(user?.pin_enrolled);

  const resetSetupState = () => {
    setSetupStep("verify");
    setCurrentPassword("");
    setTotpCode("");
    setPin("");
    setConfirmPin("");
    setError("");
    setLoading(false);
  };

  const resetForgotState = () => {
    setForgotStep("send");
    setResetOtp("");
    setResetPin("");
    setResetConfirmPin("");
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    if (!setupOpen) resetSetupState();
  }, [setupOpen]);

  useEffect(() => {
    if (!forgotOpen) resetForgotState();
  }, [forgotOpen]);

  const handleSetupPin = async () => {
    if (pin !== confirmPin) {
      setError("PIN entries do not match.");
      return;
    }
    if (pin.length !== 4) {
      setError("Enter a 4-digit PIN.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await setupZyndPin({
        currentPassword,
        totpCode,
        pin,
        confirmPin,
      });
      await refreshUser();
      pinContext?.markUnlocked();
      setSetupOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not set up PIN lock."));
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await sendZyndPinResetOtp();
      setForgotStep("reset");
    } catch (err) {
      setError(getErrorMessage(err, "Could not send reset code."));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (resetPin !== resetConfirmPin) {
      setError("PIN entries do not match.");
      return;
    }
    if (resetPin.length !== 4 || !isValidOtp(resetOtp)) {
      setError("Enter the email code and a 4-digit PIN.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await resetZyndPinWithOtp({
        otp: resetOtp,
        pin: resetPin,
        confirmPin: resetConfirmPin,
      });
      await refreshUser();
      pinContext?.markUnlocked();
      setForgotOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not reset PIN."));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="space-y-4 rounded-[var(--radius-card)] border border-border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
              <LockKeyhole className="size-5" />
            </div>
            <div className="space-y-2">
              <p className="text-compact font-semibold text-foreground">PIN lock</p>
              <p className="text-caption text-muted-foreground">
                {!mfaEnabled
                  ? "Enable MFA first, then set a 4-digit PIN to lock the admin console after inactivity."
                  : pinEnrolled
                    ? "Your PIN is required to unlock the admin console on this device."
                    : "Set a 4-digit PIN to lock the admin console after inactivity."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!pinEnrolled ? (
              <Button size="sm" disabled={!mfaEnabled} onClick={() => setSetupOpen(true)}>
                Set up PIN
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setForgotOpen(true)}>
                Reset PIN
              </Button>
            )}
          </div>
        </div>
      </div>

      <AdminFormDialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        title="Set up PIN lock"
        description="Verify your password and MFA code, then choose a 4-digit PIN."
        icon={LockKeyhole}
        iconTone="info"
        size="sm"
      >
        {setupStep === "verify" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-pin-setup-password">Current password</Label>
              <PasswordInput
                id="admin-pin-setup-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <div className="space-y-2">
              <Label>Authenticator code</Label>
              <OtpInput value={totpCode} onChange={setTotpCode} />
            </div>
            {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
            <Button
              className="w-full"
              disabled={!isValidPassword(currentPassword) || !isValidOtp(totpCode)}
              onClick={() => {
                setError("");
                setSetupStep("pin");
              }}
            >
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-center text-caption font-medium text-foreground">Create PIN</p>
              <AdminPinInput value={pin} onChange={setPin} error={!!error} />
            </div>
            <div className="space-y-2">
              <p className="text-center text-caption font-medium text-foreground">Confirm PIN</p>
              <AdminPinInput
                value={confirmPin}
                onChange={setConfirmPin}
                error={!!error || (confirmPin.length === 4 && pin !== confirmPin)}
              />
            </div>
            {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={loading}
                onClick={() => {
                  setSetupStep("verify");
                  setPin("");
                  setConfirmPin("");
                  setError("");
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
                onClick={() => void handleSetupPin()}
              >
                {loading ? "Saving…" : "Save PIN"}
              </Button>
            </div>
          </div>
        )}
      </AdminFormDialog>

      <AdminFormDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset PIN lock"
        description="We will email you a verification code to set a new PIN."
        icon={LockKeyhole}
        iconTone="warning"
        size="sm"
      >
        {forgotStep === "send" ? (
          <div className="space-y-4">
            {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
            <Button className="w-full" disabled={loading} onClick={() => void handleSendResetOtp()}>
              {loading ? "Sending…" : "Send reset code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email verification code</Label>
              <OtpInput value={resetOtp} onChange={setResetOtp} />
            </div>
            <div className="space-y-2">
              <p className="text-center text-caption font-medium text-foreground">New PIN</p>
              <AdminPinInput value={resetPin} onChange={setResetPin} />
            </div>
            <div className="space-y-2">
              <p className="text-center text-caption font-medium text-foreground">Confirm PIN</p>
              <AdminPinInput value={resetConfirmPin} onChange={setResetConfirmPin} />
            </div>
            {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
            <Button
              className="w-full"
              disabled={
                loading ||
                !isValidOtp(resetOtp) ||
                resetPin.length !== 4 ||
                resetConfirmPin.length !== 4
              }
              onClick={() => void handleResetPin()}
            >
              {loading ? "Saving…" : "Reset PIN"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={loading}
              onClick={() => void handleSendResetOtp()}
            >
              Resend code
            </Button>
          </div>
        )}
      </AdminFormDialog>
    </>
  );
}
