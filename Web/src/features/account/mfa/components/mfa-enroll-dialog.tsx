"use client";

import { Check, Copy, Download } from "lucide-react";
import { useCallback, useState } from "react";

import { AuthSubmitFooter, OtpInput } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { MfaBrandedQrImage } from "@/features/account/mfa/components/mfa-branded-qr-image";
import { MfaEnrollHeroImage } from "@/features/account/mfa/components/mfa-enroll-hero-image";
import { ApiError } from "@/lib/api-client";
import { mfaEnrollConfirm, mfaEnrollStart } from "@/lib/auth-api";
import { saveMfaBackupCodes } from "@/features/account/mfa/storage/mfa-backup-codes-storage";
import { downloadBackupCodesJson } from "@/features/account/mfa/lib/backup-codes-download";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
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

function MfaEnrollProgress({ step, compact = false }: { step: EnrollStep; compact?: boolean }) {
  const currentIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className={cn("flex gap-1.5", compact ? "mb-1" : "mb-3")}>
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
  const [manualSecret, setManualSecret] = useState("");
  const [qrPngSrc, setQrPngSrc] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const reset = useCallback(() => {
    setStep("start");
    setError("");
    setCopied(null);
    setEnrollToken("");
    setManualSecret("");
    setQrPngSrc(null);
    setTotpCode("");
    setBackupCodes([]);
  }, []);

  useResetWhenDialogOpens(open, reset);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const startEnrollment = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaEnrollStart();
      setEnrollToken(result.enroll_token);
      setManualSecret(result.manual_secret);
      setQrPngSrc(
        result.qr_png_base64 ? `data:image/png;base64,${result.qr_png_base64}` : null,
      );
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

  const { title } = STEP_COPY[step];

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      maxWidth="lg"
    >
      <div className={cn("px-5 pb-4", step === "start" ? "pt-4" : "pt-1.5")}>
          {step === "start" ? <MfaEnrollHeroImage className="mb-4" /> : null}

          <MfaEnrollProgress step={step} compact={step !== "start"} />

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
            <div className="space-y-2.5">
              {enrollToken ? (
                  <MfaBrandedQrImage
                    kind="enroll"
                    token={enrollToken}
                    initialSrc={qrPngSrc}
                    alt={copy.mfa.enroll.confirmTitle}
                    className="-mt-0.5"
                  />
              ) : null}

              <div className="relative flex items-center justify-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="shrink-0 text-center text-caption text-muted-foreground">
                  {copy.mfa.orEnterManually}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="mx-auto flex w-full max-w-sm items-center gap-2 rounded-[var(--radius-control)] border border-border bg-muted/20 px-2.5 py-2">
                <p className="min-w-0 flex-1 break-all text-center font-mono text-caption leading-snug">
                  {manualSecret}
                </p>
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

              <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="mfa-enroll-code" className="text-caption font-medium">
                      Verification code
                    </Label>
                    <p className="text-caption leading-relaxed text-muted-foreground">
                      {copy.mfa.enroll.confirmDescription}
                    </p>
                  </div>
                  <OtpInput
                    id="mfa-enroll-code"
                    value={totpCode}
                    error={!!error}
                    onChange={(value) => {
                      setTotpCode(value);
                      if (error) setError("");
                    }}
                  />
                </div>
              </div>

              <FieldMessage message={error} />

              <AuthSubmitFooter className="pt-2">
                <Button
                  className="w-full"
                  onClick={confirmEnrollment}
                  disabled={loading || totpCode.length !== 6}
                >
                  {loading ? copy.mfa.verifying : copy.mfa.enroll.verifyAndEnable}
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}

          {step === "backup" ? (
            <div className="mt-2 space-y-3">
              <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-success/25 bg-success/5 px-3 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-5" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-compact font-semibold text-foreground">
                    {copy.mfa.enroll.successTitle}
                  </p>
                  <p className="mt-0.5 text-caption leading-snug text-muted-foreground">
                    {copy.mfa.enroll.successDescription}
                  </p>
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-caption font-medium text-foreground">
                      {copy.mfa.enroll.backupTitle}
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {copy.mfa.enroll.backupDescription}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Copy all backup codes"
                      onClick={handleCopyBackupCodes}
                    >
                      {copied === "backup" ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={copy.mfa.enroll.downloadBackupCodesJson}
                      onClick={() => downloadBackupCodesJson(backupCodes, user?.email)}
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 font-mono text-caption">
                  {backupCodes.map((code) => (
                    <span
                      key={code}
                      className="rounded-[var(--radius-control)] border border-border bg-muted/20 px-2 py-1.5 text-center"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <AuthSubmitFooter>
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
