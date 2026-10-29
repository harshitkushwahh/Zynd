"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import { requestCasImport, submitCasQr } from "@/features/invest/api/invest-api";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const MFC_LOTTIE_SRC = "/MFC.lottie";

const MFC_ORIGINS = new Set([
  "https://mfc-cas-uat.mfcentral.com",
  "https://cas-oauth.mfcentral.com",
  "https://cas.mfcentral.com",
]);

type MfCasImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

function errorText(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return copy.mutualFunds.casImportFailed;
}

function MfcLottie() {
  return (
    <DotLottieReact
      src={MFC_LOTTIE_SRC}
      loop
      autoplay
      className="mx-auto h-80 w-full max-w-[22rem] sm:h-96"
    />
  );
}

const CAS_STEPS = [
  { step: 1, title: copy.mutualFunds.casStepOtp, body: copy.mutualFunds.casStepOtpBody },
  { step: 2, title: copy.mutualFunds.casStepGenerateQr, body: copy.mutualFunds.casStepGenerateQrBody },
  { step: 3, title: copy.mutualFunds.casStepQrContinue, body: copy.mutualFunds.casStepQrContinueBody },
] as const;

function qrFromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const encoded = value.includes(",") ? value.split(",")[1] : value;
      if (!encoded) {
        reject(new Error(copy.mutualFunds.casImportFailed));
        return;
      }
      resolve(encoded);
    };
    reader.onerror = () => reject(reader.error ?? new Error(copy.mutualFunds.casImportFailed));
    reader.readAsDataURL(file);
  });
}

export function MfCasImportDialog({ open, onOpenChange, onCompleted }: MfCasImportDialogProps) {
  const queryClient = useQueryClient();
  const [importId, setImportId] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "waiting" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setImportId(null);
      setLaunchUrl(null);
      setPhase("idle");
      setBusy(false);
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !importId || phase !== "waiting") return;

    async function onMessage(event: MessageEvent) {
      const sameOrigin = event.origin === window.location.origin;
      if (!sameOrigin && !MFC_ORIGINS.has(event.origin)) return;
      const message = event.data as { type?: string; data?: Record<string, string> } | null;
      if (!message || (message.type !== "mfc-cas-complete" && message.type !== "mfc-cas-download")) return;

      if (message.type === "mfc-cas-complete" && message.data?.status === "error") {
        setError(message.data.message || copy.mutualFunds.casImportFailed);
        setPhase("idle");
        return;
      }

      const qr = message.type === "mfc-cas-download" ? message.data?.base64 : "";
      if (!qr) return;
      setBusy(true);
      setError(null);
      try {
        const result = await submitCasQr(importId!, qr);
        setSuccess(copy.mutualFunds.casSuccess.replace("{count}", String(result.holdings_count)));
        setPhase("done");
        await queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.invest.externalHoldings() });
        onCompleted?.();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(false);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [importId, onCompleted, open, phase, queryClient]);

  async function startImport() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const started = await requestCasImport();
      if (!started.launch_url) {
        setError(copy.mutualFunds.casImportFailed);
        return;
      }
      setImportId(started.import_id);
      setLaunchUrl(started.launch_url);
      const popup = window.open(started.launch_url, "mfc-cas", "width=500,height=700");
      if (!popup) setError(copy.mutualFunds.casPopupBlocked);
      setPhase("waiting");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File | undefined) {
    if (!file || !importId) return;
    setBusy(true);
    setError(null);
    try {
      const qr = await qrFromFile(file);
      const result = await submitCasQr(importId, qr);
      setSuccess(copy.mutualFunds.casSuccess.replace("{count}", String(result.holdings_count)));
      setPhase("done");
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invest.externalHoldings() });
      onCompleted?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const currentStep = phase === "done" ? 4 : phase === "waiting" ? 3 : 1;

  return (
    <SplitFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.mutualFunds.casDialogTitle}
      illustration={<MfcLottie />}
      points={[]}
      contentClassName="pl-3 sm:pl-4"
      rightHeader={
        <div>
          <h2 className="text-h3 font-semibold tracking-tight text-foreground">
            {copy.mutualFunds.casDialogTitle}
          </h2>
          <p className="mt-1.5 text-caption leading-relaxed text-muted-foreground">
            {copy.mutualFunds.casDialogDescription}
          </p>
        </div>
      }
    >
      <ol className="space-y-5">
        {CAS_STEPS.map((item) => {
          const done = currentStep > item.step;
          const active = currentStep === item.step;
          return (
            <li key={item.step} className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold tabular-nums",
                  done && "bg-success text-success-foreground",
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {item.step}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={cn("text-compact font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
                  {item.title}
                </p>
                <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">{item.body}</p>
                {item.step === 3 && phase !== "done" ? (
                  <Button
                    type="button"
                    className="mt-4 h-11 gap-2 rounded-full px-5"
                    disabled={busy}
                    onClick={() => {
                      if (launchUrl && phase === "waiting") {
                        window.open(launchUrl, "mfc-cas", "width=500,height=700");
                        return;
                      }
                      void startImport();
                    }}
                  >
                    {busy ? copy.mutualFunds.casImporting : copy.mutualFunds.casStart}
                    {busy ? null : <ExternalLink className="size-4" aria-hidden />}
                  </Button>
                ) : null}
                {item.step === 3 && phase === "waiting" ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-compact text-muted-foreground">{copy.mutualFunds.casWaiting}</p>
                    <label className="block text-compact font-medium text-foreground">
                      {copy.mutualFunds.casUploadLabel}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="mt-2 block w-full text-caption"
                        disabled={busy}
                        onChange={(event) => {
                          void onUpload(event.target.files?.[0]);
                        }}
                      />
                    </label>
                    <p className="text-caption text-muted-foreground">{copy.mutualFunds.casUploadHint}</p>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {error ? <div className="mt-4"><FieldMessage variant="error" message={error} /></div> : null}
      {success ? <div className="mt-4"><FieldMessage variant="success" message={success} /></div> : null}
    </SplitFormDialog>
  );
}
