"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  acceptConsents,
  fetchConsentCurrent,
  fetchRequiredConsents,
  type ConsentCurrentVersion,
} from "@/features/consent/lib/consent-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ConsentReacceptDialogProps = {
  context?: "login" | "signup" | "kyc";
  enabled?: boolean;
};

const PLATFORM_TERMS_KEY = "platform.terms_of_service";
const PLATFORM_PRIVACY_KEY = "platform.privacy_policy";

type LegalDocLink = {
  label: string;
  documentUrl?: string | null;
  versionLabel?: string;
};

function consentItemBody(item: ConsentCurrentVersion): string | null {
  const summary = item.summary_text?.trim();
  if (!summary || summary === item.title.trim()) {
    return item.description?.trim() || null;
  }
  return summary;
}

export function ConsentReacceptDialog({ context = "login", enabled = true }: ConsentReacceptDialogProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConsentCurrentVersion[]>([]);
  const [legalDocs, setLegalDocs] = useState<LegalDocLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const primaryItem = items[0] ?? null;
  const showSignupLegalLayout = items.length === 1 && primaryItem?.consent_key === "platform.signup_legal";

  const loadRequired = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetchRequiredConsents(context);
      const required = response.items ?? [];
      setItems(required);
      setOpen(required.length > 0);
      setAcknowledged(false);
    } catch {
      setItems([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [context, enabled]);

  useEffect(() => {
    void loadRequired();
  }, [loadRequired]);

  useEffect(() => {
    if (!open || !showSignupLegalLayout) {
      setLegalDocs([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [terms, privacy] = await Promise.all([
          fetchConsentCurrent(PLATFORM_TERMS_KEY),
          fetchConsentCurrent(PLATFORM_PRIVACY_KEY),
        ]);
        if (cancelled) return;
        setLegalDocs([
          {
            label: copy.consent.reaccept.termsLabel,
            documentUrl: terms.document_url,
            versionLabel: terms.version_label,
          },
          {
            label: copy.consent.reaccept.privacyLabel,
            documentUrl: privacy.document_url,
            versionLabel: privacy.version_label,
          },
          { label: copy.consent.reaccept.tariffLabel, documentUrl: null },
        ]);
      } catch {
        if (!cancelled) {
          setLegalDocs([
            { label: copy.consent.reaccept.termsLabel },
            { label: copy.consent.reaccept.privacyLabel },
            { label: copy.consent.reaccept.tariffLabel },
          ]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, showSignupLegalLayout]);

  const acknowledgeText = useMemo(() => {
    if (showSignupLegalLayout) {
      return copy.consent.reaccept.acknowledge;
    }
    if (items.length === 1 && primaryItem?.summary_text?.trim()) {
      return primaryItem.summary_text.trim();
    }
    return copy.consent.reaccept.acknowledge;
  }, [items.length, primaryItem?.summary_text, showSignupLegalLayout]);

  const handleAcceptAll = async () => {
    if (!acknowledged) {
      setError(copy.consent.reaccept.acknowledgeRequired);
      return;
    }
    if (items.length === 0) {
      setOpen(false);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await acceptConsents({ consent_keys: items.map((item) => item.consent_key) });
      setOpen(false);
      setItems([]);
      setAcknowledged(false);
    } catch {
      setError(copy.consent.reaccept.saveFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) return;
    setOpen(next);
  };

  if (!open || items.length === 0) return null;

  const busy = submitting || loading;
  const canConfirm = acknowledged && !busy;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        motion="fade"
        showCloseButton={false}
        overlayClassName="z-[60]"
        className={cn(
          "z-[60] flex max-h-[min(92vh,40rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-zynd-high ring-1 ring-border/80",
        )}
      >
        <DialogTitle className="sr-only">{copy.consent.reaccept.title}</DialogTitle>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5 pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-info/10 text-info">
              <Scale className="size-6" strokeWidth={2.25} aria-hidden />
            </div>
            <h2 className="mt-4 text-h4 font-semibold text-foreground">{copy.consent.reaccept.title}</h2>
            <p className="mt-2 max-w-sm text-caption leading-relaxed text-muted-foreground">
              {copy.consent.reaccept.description}
            </p>
            {primaryItem?.version_label ? (
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                {copy.consent.reaccept.versionLabel(primaryItem.version_label)}
              </p>
            ) : null}
          </div>

          {showSignupLegalLayout ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {copy.consent.reaccept.documentsHeading}
              </p>
              <ul className="divide-y divide-border/80 overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted/15">
                {legalDocs.map((doc) => (
                  <li key={doc.label}>
                    {doc.documentUrl ? (
                      <a
                        href={doc.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
                      >
                        <span className="text-compact font-medium text-foreground">{doc.label}</span>
                        <ExternalLink className="size-4 shrink-0 text-primary" aria-hidden />
                      </a>
                    ) : (
                      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                        <span className="text-compact font-medium text-foreground">{doc.label}</span>
                        <span className="text-[11px] text-muted-foreground">Included in bundle</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const body = consentItemBody(item);
                return (
                  <li
                    key={item.consent_key}
                    className="rounded-[var(--radius-card)] border border-border bg-muted/15 px-4 py-3.5"
                  >
                    <p className="text-compact font-medium text-foreground">{item.title}</p>
                    {body ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{body}</p>
                    ) : null}
                    {item.document_url ? (
                      <a
                        href={item.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        {copy.consent.reaccept.openDocument(item.title)}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3.5 transition-colors",
              acknowledged
                ? "border-primary/35 bg-primary/[0.05] shadow-zynd-low ring-1 ring-primary/15"
                : "border-border bg-muted/20 hover:border-border/90 hover:bg-muted/30",
            )}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => {
                setAcknowledged(event.target.checked);
                setError("");
              }}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-control)] border-2 transition-colors",
                acknowledged
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background",
              )}
            >
              {acknowledged ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 text-left text-compact font-medium leading-snug text-foreground">
              {acknowledgeText}
            </span>
          </label>

          {error ? <FieldMessage message={error} /> : null}
        </div>

        <div className="border-t border-border/80 px-6 py-4">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!canConfirm}
            onClick={() => void handleAcceptAll()}
          >
            {busy ? copy.consent.reaccept.saving : copy.consent.reaccept.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
