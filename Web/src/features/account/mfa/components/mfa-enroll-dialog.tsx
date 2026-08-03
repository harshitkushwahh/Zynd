"use client";

import Link from "next/link";
import { Check, Copy, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import QRCode from "react-qr-code";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { mfaEnrollConfirm, mfaEnrollStart } from "@/lib/auth-api";
import { saveMfaBackupCodes } from "@/features/account/mfa/storage/mfa-backup-codes-storage";
import { downloadBackupCodesJson } from "@/features/account/mfa/lib/backup-codes-download";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfaEnrollDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

type EnrollStep = "start" | "confirm" | "backup";

const STEPS: { id: EnrollStep; label: string }[] = [
  { id: "start", label: "Get started" },
  { id: "confirm", label: "Verify app" },
  { id: "backup", label: "Backup codes" },
];

const STEP_COPY: Record<EnrollStep, { title: string; description: string }> = {
  start: {
    title: copy.mfa.enroll.startTitle,
    description: copy.mfa.enroll.startDescription,
  },
  confirm: {
    title: copy.mfa.enroll.confirmTitle,
    description: copy.mfa.enroll.confirmDescription,
  },
  backup: {
    title: copy.mfa.enroll.successTitle,
    description: copy.mfa.enroll.successDescription,
  },
};

const START_POINTS = [...copy.mfa.enroll.benefits];

function MfaEnrollProgress({ step }: { step: EnrollStep }) {
  const currentIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className="mb-3">
      <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-muted/50 px-2 py-0.5 text-caption font-medium text-muted-foreground">
        Step {currentIndex + 1} of {STEPS.length}
      </span>
      <div className="mt-2 flex gap-1.5">
        {STEPS.map((item, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div
              key={item.id}
              className={cn(
                "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
                done && "bg-success",
                active && "bg-primary",
                !done && !active && "bg-border"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function MfaEnrollDialog({ open, onOpenChange, onCompleted }: MfaEnrollDialogProps) {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<EnrollStep>("start");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"secret" | "backup" | null>(null);
  const [enrollToken, setEnrollToken] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const reset = () => {
    setStep("start");
    setError("");
    setCopied(null);
    setEnrollToken("");
    setQrUri("");
    setManualSecret("");
    setTotpCode("");
    setBackupCodes([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const startEnrollment = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaEnrollStart();
      setEnrollToken(result.enroll_token);
      setQrUri(result.qr_uri);
      setManualSecret(result.manual_secret);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.enroll.couldNotStart);
    } finally {
      setLoading(false);
    }
  };

  const confirmEnrollment = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaEnrollConfirm(enrollToken, totpCode);
      setBackupCodes(result.backup_codes);
      if (user?.id) {
        saveMfaBackupCodes(user.id, result.backup_codes);
      }
      await refreshUser();
      setStep("backup");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.enroll.invalidCode);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!manualSecret) return;
    await copyText(manualSecret);
    setCopied("secret");
    window.setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyBackupCodes = async () => {
    if (!backupCodes.length) return;
    await copyText(backupCodes.join("\n"));
    setCopied("backup");
    window.setTimeout(() => setCopied(null), 2000);
  };

  const { title, description } = STEP_COPY[step];

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      icon={ShieldCheck}
      maxWidth="lg"
      headerDensity="compact"
    >
      <div className="px-5 py-4">
          <MfaEnrollProgress step={step} />

          {step === "start" ? (
            <div className="space-y-5">
              <ul className="space-y-2.5">
                {START_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-compact text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <FieldMessage message={error} />

              <AuthSubmitFooter>
                <Button className="w-full" onClick={startEnrollment} disabled={loading}>
                  {loading ? copy.mfa.preparing : copy.mfa.continue}
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="space-y-3">
              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-3 shadow-zynd-low">
                {qrUri ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-[var(--radius-control)] border border-border bg-white p-2 shadow-zynd-low">
                      <QRCode value={qrUri} size={112} />
                    </div>
                  </div>
                ) : null}

                <div className="relative my-3 flex items-center justify-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="shrink-0 text-center text-caption text-muted-foreground">
                    {copy.mfa.orEnterManually}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="mx-auto w-full max-w-sm rounded-[var(--radius-control)] border border-border bg-background px-2.5 py-2 text-center">
                  <div className="mb-1 flex items-center justify-center gap-2">
                    <p className="text-caption font-medium text-foreground">Setup key</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label="Copy setup key"
                      onClick={handleCopySecret}
                    >
                      {copied === "secret" ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="break-all font-mono text-caption leading-snug">{manualSecret}</p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="mfa-enroll-code"
                  className="mb-1 block text-caption font-medium text-foreground"
                >
                  Verification code
                </label>
                <input
                  id="mfa-enroll-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(event) =>
                    setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  className="auth-input-underline w-full text-center tracking-[0.35em] text-compact font-medium"
                />
              </div>

              <FieldMessage message={error} />

              <AuthSubmitFooter className="space-y-2 pt-2">
                <Button
                  className="w-full"
                  onClick={confirmEnrollment}
                  disabled={loading || totpCode.length !== 6}
                >
                  {loading ? copy.mfa.verifying : copy.mfa.enroll.verifyAndEnable}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-full"
                  disabled={loading}
                  onClick={() => {
                    setStep("start");
                    setError("");
                    setTotpCode("");
                  }}
                >
                  Back
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}

          {step === "backup" ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-success/25 bg-success/5 px-4 py-5 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-6" strokeWidth={2.5} />
                </div>
                <p className="text-compact font-semibold text-foreground">
                  {copy.mfa.enroll.successTitle}
                </p>
                <p className="mt-1 max-w-sm text-caption leading-relaxed text-muted-foreground">
                  {copy.mfa.enroll.successDescription}
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-4 shadow-zynd-low">
                <div className="mb-3 space-y-1">
                  <p className="text-caption font-medium text-foreground">
                    {copy.mfa.enroll.backupTitle}
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {copy.mfa.enroll.backupDescription}
                  </p>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-compact">
                  {backupCodes.map((code) => (
                    <span
                      key={code}
                      className="rounded-[var(--radius-control)] border border-border bg-background px-2.5 py-2 text-center"
                    >
                      {code}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyBackupCodes}>
                    {copied === "backup" ? (
                      <>
                        <Check className="size-3.5 text-success" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copy all
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadBackupCodesJson(backupCodes, user?.email)}
                  >
                    <Download className="size-3.5" />
                    {copy.mfa.enroll.downloadBackupCodesJson}
                  </Button>
                </div>
              </div>

              {user && !user.pin_enrolled ? (
                <div className="rounded-[var(--radius-card)] border border-border bg-background p-4">
                  <p className="text-compact font-medium text-foreground">
                    {copy.mfa.enroll.nextPinTitle}
                  </p>
                  <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
                    {copy.mfa.enroll.nextPinDescription}
                  </p>
                  <Button asChild className="mt-3 w-full sm:w-auto">
                    <Link href="/dashboard/settings?section=zynd-pin">
                      {copy.mfa.enroll.nextPinAction}
                    </Link>
                  </Button>
                </div>
              ) : user?.fund_movement_eligible ? (
                <div className="rounded-[var(--radius-card)] border border-success/25 bg-success/5 p-4">
                  <p className="text-compact font-medium text-foreground">
                    {copy.mfa.enroll.investReadyTitle}
                  </p>
                  <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
                    {copy.mfa.enroll.investReadyDescription}
                  </p>
                  <Button asChild className="mt-3 w-full sm:w-auto">
                    <Link href="/dashboard/invest">{copy.mfa.enroll.investReadyAction}</Link>
                  </Button>
                </div>
              ) : null}

              <AuthSubmitFooter hint={copy.mfa.backupCodesOfflineHint}>
                <Button
                  className="w-full"
                  onClick={() => {
                    onCompleted?.();
                    handleOpenChange(false);
                  }}
                >
                  Done
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}
        </div>
    </BrandDialog>
  );
}
