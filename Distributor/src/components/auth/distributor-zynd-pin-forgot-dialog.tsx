"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, LockKeyhole, Mail, MailCheck } from "lucide-react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { ApiError } from "@/lib/api-client";
import {
  fetchDistributorBackendUser,
} from "@/lib/distributor-auth-api";
import { sendZyndPinResetLink } from "@/lib/distributor-pin-api";
import { maskEmail } from "@/lib/mask-email";

type DistributorZyndPinForgotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DistributorZyndPinForgotDialog({
  open,
  onOpenChange,
}: DistributorZyndPinForgotDialogProps) {
  const { refreshUser } = useDistributorAuth();
  const [step, setStep] = useState<"send" | "sent">("send");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionSyncing, setSessionSyncing] = useState(false);
  const [sessionSyncError, setSessionSyncError] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [emailDelivered, setEmailDelivered] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailPreview = maskedEmail || (sessionEmail ? maskEmail(sessionEmail) : null);
  const showDevLink = Boolean(devResetUrl);

  const resetState = () => {
    setStep("send");
    setSessionEmail(null);
    setSessionSyncError("");
    setMaskedEmail("");
    setDevResetUrl(null);
    setEmailDelivered(true);
    setCopied(false);
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setSessionSyncing(true);
    setSessionSyncError("");
    setSessionEmail(null);

    void (async () => {
      try {
        const me = await fetchDistributorBackendUser();
        if (cancelled) return;

        setSessionEmail(me.email);
        await refreshUser();
      } catch (err) {
        if (!cancelled) {
          setSessionSyncError(
            err instanceof ApiError ? err.message : "Could not verify your signed-in account.",
          );
        }
      } finally {
        if (!cancelled) setSessionSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, refreshUser]);

  const handleSendLink = async () => {
    if (!sessionEmail) return;

    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const result = await sendZyndPinResetLink();
      setMaskedEmail(result.masked_email);
      setEmailDelivered(result.email_delivered);
      setDevResetUrl(result.dev_reset_url ?? null);
      setStep("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send reset link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDevLink = async () => {
    if (!devResetUrl) return;
    try {
      await navigator.clipboard.writeText(devResetUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const canSend = Boolean(sessionEmail) && !sessionSyncing && !sessionSyncError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="distributor-pin-forgot-dialog z-[110] max-w-md gap-0 p-0"
        overlayClassName="z-[110]"
      >
        {step === "send" ? (
          <>
            <div className="distributor-pin-forgot-dialog__hero distributor-pin-forgot-dialog__hero--send">
              <span
                className="distributor-pin-forgot-dialog__icon distributor-pin-forgot-dialog__icon--primary"
                aria-hidden
              >
                <LockKeyhole className="size-6" strokeWidth={2.25} />
              </span>
              <DialogTitle className="distributor-pin-forgot-dialog__title">Reset PIN lock</DialogTitle>
              <DialogDescription className="distributor-pin-forgot-dialog__desc">
                We&apos;ll email you a secure link to set or reset your Zynd PIN.
              </DialogDescription>
            </div>

            <div className="distributor-pin-forgot-dialog__body">
              {sessionSyncing ? (
                <p className="distributor-pin-forgot-dialog__note">Confirming your signed-in account…</p>
              ) : null}

              {emailPreview ? (
                <div className="distributor-pin-forgot-dialog__email-chip">
                  <Mail className="distributor-pin-forgot-dialog__email-chip-icon size-4" aria-hidden />
                  <span>{emailPreview}</span>
                </div>
              ) : null}

              {sessionSyncError ? (
                <DistributorFeedbackMessage variant="error">{sessionSyncError}</DistributorFeedbackMessage>
              ) : null}

              {error ? <DistributorFeedbackMessage variant="error">{error}</DistributorFeedbackMessage> : null}

              <div className="distributor-pin-forgot-dialog__actions">
                <DistributorActionButton
                  type="button"
                  variant="primary"
                  className="w-full"
                  disabled={loading || !canSend}
                  onClick={() => void handleSendLink()}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </DistributorActionButton>
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className={`distributor-pin-forgot-dialog__hero distributor-pin-forgot-dialog__hero--sent${
                showDevLink ? " distributor-pin-forgot-dialog__hero--dev" : ""
              }`}
            >
              <span
                className={`distributor-pin-forgot-dialog__icon ${
                  showDevLink
                    ? "distributor-pin-forgot-dialog__icon--primary"
                    : "distributor-pin-forgot-dialog__icon--success"
                }`}
                aria-hidden
              >
                {showDevLink ? (
                  <ExternalLink className="size-6" strokeWidth={2.25} />
                ) : (
                  <MailCheck className="size-6" strokeWidth={2.25} />
                )}
              </span>
              <DialogTitle className="distributor-pin-forgot-dialog__title">
                {showDevLink ? "Reset link ready" : "Check your email"}
              </DialogTitle>
              {showDevLink ? (
                <DialogDescription className="distributor-pin-forgot-dialog__desc">
                  Email delivery is not configured in this environment. Use the link below to reset your PIN.
                </DialogDescription>
              ) : null}
            </div>

            <div className="distributor-pin-forgot-dialog__body">
              {emailPreview ? (
                <div className="distributor-pin-forgot-dialog__email-chip">
                  <Mail className="distributor-pin-forgot-dialog__email-chip-icon size-4" aria-hidden />
                  <span>{emailPreview}</span>
                </div>
              ) : null}

              {showDevLink && devResetUrl ? (
                <div className="distributor-pin-forgot-dialog__dev-link">
                  <p className="distributor-pin-forgot-dialog__dev-link-url">{devResetUrl}</p>
                  <div className="distributor-pin-forgot-dialog__dev-link-actions">
                    <DistributorActionButton
                      type="button"
                      variant="primary"
                      className="w-full"
                      onClick={() => window.open(devResetUrl, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="size-4" aria-hidden />
                      Open reset link
                    </DistributorActionButton>
                    <DistributorActionButton
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => void handleCopyDevLink()}
                    >
                      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                      {copied ? "Copied" : "Copy link"}
                    </DistributorActionButton>
                  </div>
                </div>
              ) : emailDelivered ? (
                <DistributorFeedbackMessage variant="success">
                  Reset link sent successfully.
                </DistributorFeedbackMessage>
              ) : (
                <DistributorFeedbackMessage variant="error">
                  We could not deliver the reset email. Try again or contact support.
                </DistributorFeedbackMessage>
              )}

              <p className="distributor-pin-forgot-dialog__note">
                {showDevLink
                  ? "The link expires after a short time. Complete the reset, then return here to unlock with your new PIN."
                  : "The link expires after a short time. Complete the reset from your email, then return here to unlock with your new PIN."}
              </p>

              <div className="distributor-pin-forgot-dialog__actions">
                <div className="distributor-pin-forgot-dialog__actions-row">
                  <DistributorActionButton
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading || !canSend}
                    onClick={() => void handleSendLink()}
                  >
                    {loading ? "Sending…" : "Resend link"}
                  </DistributorActionButton>
                  <DistributorActionButton
                    type="button"
                    variant="primary"
                    className="w-full"
                    onClick={() => onOpenChange(false)}
                  >
                    Done
                  </DistributorActionButton>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
