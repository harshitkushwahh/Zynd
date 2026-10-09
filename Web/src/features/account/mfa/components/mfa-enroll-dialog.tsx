"use client";

import { Check, Copy, Download, Eye, KeyRound, QrCode, Save, ShieldCheck, Smartphone } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";

import { OtpInfoBanner, OtpInput } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
import { SplitFormStepProgress, type SplitFormStepItem } from "@/components/ui/split-form-step-progress";
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

type MfaEnrollDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

type EnrollStep = "start" | "confirm" | "backup";

const ENROLL_STEPS: SplitFormStepItem[] = [
  { step: 1, label: "Get started" },
  { step: 2, label: "Verify app" },
  { step: 3, label: "Backup codes" },
];

const STEP_NUMBER: Record<EnrollStep, number> = {
  start: 1,
  confirm: 2,
  backup: 3,
};

const START_FEATURE_ICONS = [
  { icon: ShieldCheck, iconClassName: "bg-primary/10 text-primary" },
  { icon: Smartphone, iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  { icon: KeyRound, iconClassName: "bg-success/10 text-success" },
] as const;

const CONFIRM_POINT_ICONS = [
  { icon: QrCode, iconClassName: "bg-primary/10 text-primary" },
  { icon: Copy, iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
] as const;

const BACKUP_POINT_ICONS = [
  { icon: Save, iconClassName: "bg-primary/10 text-primary" },
  { icon: ShieldCheck, iconClassName: "bg-success/10 text-success" },
] as const;

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function MfaStoreBadges({ className }: { className?: string }) {
  return (
    <Image
      src="/badge-store.png"
      alt=""
      width={560}
      height={168}
      sizes="(max-width: 640px) 220px, 280px"
      className={className}
    />
  );
}

function MfaEnrollLaptopImage({ className }: { className?: string }) {
  return (
    <Image
      src="/mfa-laptop.png"
      alt=""
      width={707}
      height={353}
      sizes="(max-width: 640px) 260px, 320px"
      className={className}
    />
  );
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
  const [setupKeyOpen, setSetupKeyOpen] = useState(false);

  const reset = useCallback(() => {
    setStep("start");
    setSetupKeyOpen(false);
    setError("");
    setCopied(null);
    setEnrollToken("");
    setManualSecret("");
    setQrPngSrc(null);
    setTotpCode("");
    setBackupCodes([]);
  }, []);

  useResetWhenDialogOpens(open, reset);

  const dialogTitle = useMemo(() => {
    if (step === "start") return copy.mfa.enroll.startTitle;
    if (step === "confirm") return copy.mfa.enroll.confirmTitle;
    return copy.mfa.enroll.successTitle;
  }, [step]);

  const points = useMemo(() => {
    if (step === "start") {
      return copy.mfa.enroll.startFeaturePoints.map((point, index) => ({
        ...point,
        icon: START_FEATURE_ICONS[index]?.icon ?? ShieldCheck,
        iconClassName: START_FEATURE_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
      }));
    }
    if (step === "confirm") {
      return copy.mfa.enroll.confirmIntroPoints.map((point, index) => ({
        ...point,
        icon: CONFIRM_POINT_ICONS[index]?.icon ?? QrCode,
        iconClassName: CONFIRM_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
      }));
    }
    return copy.mfa.enroll.backupIntroPoints.map((point, index) => ({
      ...point,
      icon: BACKUP_POINT_ICONS[index]?.icon ?? Save,
      iconClassName: BACKUP_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
    }));
  }, [step]);

  const startEnrollment = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaEnrollStart();
      setEnrollToken(result.enroll_token);
      setManualSecret(result.manual_secret);
      setQrPngSrc(result.qr_png_base64 ? `data:image/png;base64,${result.qr_png_base64}` : null);
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

  return (
    <>
    <SplitFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      gridClassName="max-h-[min(90vh,36rem)]"
      illustration={
        <MfaEnrollHeroImage
          className={
            step === "confirm"
              ? "w-full max-w-[10.5rem] sm:max-w-[11rem]"
              : "w-full max-w-[13rem] sm:max-w-sm"
          }
        />
      }
      rightHeader={<SplitFormStepProgress steps={ENROLL_STEPS} currentStep={STEP_NUMBER[step]} />}
      points={points}
      footer={
        step === "start" ? (
          <Button
            type="button"
            className="h-11 w-full rounded-full px-5 sm:w-auto"
            onClick={() => void startEnrollment()}
            disabled={loading}
          >
            {loading ? copy.mfa.preparing : copy.mfa.continue}
          </Button>
        ) : step === "confirm" ? (
          <Button
            type="button"
            className="h-11 w-full rounded-full px-5 sm:w-auto"
            onClick={() => void confirmEnrollment()}
            disabled={loading || totpCode.length !== 6}
          >
            {loading ? copy.mfa.verifying : copy.mfa.enroll.verifyAndEnable}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 w-full rounded-full px-5 sm:w-auto"
            onClick={() => {
              onCompleted?.();
              onOpenChange(false);
            }}
          >
            Done
          </Button>
        )
      }
    >
      {step === "start" ? (
        <div className="min-w-0 space-y-4">
          <MfaEnrollLaptopImage className="mx-auto h-auto w-full max-w-[13.5rem] object-contain sm:max-w-[15rem]" />
          <ol className="space-y-3">
            {copy.mfa.enroll.startIntroPoints.map((point, index) => (
              <li key={point.title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-semibold text-primary tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-compact font-medium text-foreground">{point.title}</span>
                  <span className="mt-0.5 block text-caption text-muted-foreground">{point.description}</span>
                  {index === 0 ? (
                    <MfaStoreBadges className="mt-2.5 h-9 w-auto max-w-full object-contain object-left" />
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
          <FieldMessage message={error} />
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col items-center gap-2">
            {enrollToken ? (
              <MfaBrandedQrImage
                kind="enroll"
                token={enrollToken}
                initialSrc={qrPngSrc}
                alt={copy.mfa.enroll.confirmTitle}
                className="mx-auto"
                fetchSize={220}
                imageClassName="size-[9.25rem] object-contain sm:size-[10rem]"
              />
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              disabled={!manualSecret}
              onClick={() => setSetupKeyOpen(true)}
            >
              <Eye className="size-3.5" aria-hidden />
              {copy.mfa.enroll.showSetupKey}
            </Button>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <Label htmlFor="mfa-enroll-code" className="sr-only">
              {copy.mfa.enroll.confirmDescription}
            </Label>
            <div className="w-full max-w-[14.5rem] [&>div>div]:gap-1.5 [&_input]:h-9 [&_input]:text-compact [&_input]:shadow-none">
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
            {error ? <FieldMessage message={error} className="text-center" /> : null}
          </div>
        </div>
      ) : null}

      {step === "backup" ? (
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-3 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-compact font-semibold text-foreground">{copy.mfa.enroll.successTitle}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">{copy.mfa.enroll.successDescription}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-compact font-semibold text-foreground">{copy.mfa.enroll.backupTitle}</p>
                <p className="mt-1 text-caption text-muted-foreground">{copy.mfa.enroll.backupDescription}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Copy all backup codes"
                  onClick={() => void handleCopyBackupCodes()}
                >
                  {copied === "backup" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
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

            <div className="grid grid-cols-2 gap-2 font-mono text-caption">
              {backupCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-center"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </SplitFormDialog>

    <BrandDialog
      open={setupKeyOpen}
      onOpenChange={setSetupKeyOpen}
      title={copy.mfa.enroll.setupKeyDialogTitle}
      maxWidth="md"
    >
      <div className="space-y-4 px-5 pb-5 pt-1">
        <div className="flex min-w-0 items-center gap-2">
          <Input
            readOnly
            value={manualSecret}
            className="h-11 min-w-0 flex-1 font-mono text-caption"
            aria-label={copy.mfa.enroll.setupKeyDialogTitle}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Copy setup key"
            onClick={() => void handleCopySecret()}
          >
            {copied === "secret" ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <OtpInfoBanner message={copy.mfa.enroll.setupKeyDialogDescription} />
      </div>
    </BrandDialog>
    </>
  );
}
