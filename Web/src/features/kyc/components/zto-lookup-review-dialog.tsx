"use client";

import Image from "next/image";
import { useState } from "react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { acceptZtoReview, declineZtoReview } from "@/features/kyc/lib/zto-api";
import type { ZtoReviewFields } from "@/features/kyc/lib/zto-types";
import {
  normalizeZtoReviewFields,
  validateZtoReviewFields,
  type ZtoReviewErrors,
} from "@/features/kyc/lib/zto-review-validation";
import { copy } from "@/shared/config/copy";

const LOOKUP_ILLUSTRATION_SRC = "/lookup.png";

const EMPTY_FIELDS: ZtoReviewFields = {
  name: "",
  pan: "",
  date_of_birth: "",
  bank_account_number: "",
  ifsc_code: "",
  address_line: "",
};

type ZtoLookupReviewDialogProps = {
  open: boolean;
  initialFields: ZtoReviewFields | null;
  /** Called after the user explicitly accepts or declines. */
  onResolved: (decision: "accepted" | "declined") => void;
};

/**
 * Non-dismissible confirmation form: no backdrop close, no Escape, no header close.
 * The only exits are Accept and Decline.
 */
export function ZtoLookupReviewDialog({ open, initialFields, onResolved }: ZtoLookupReviewDialogProps) {
  const t = copy.zto.review;
  const [values, setValues] = useState<ZtoReviewFields>(() => ({ ...EMPTY_FIELDS, ...initialFields }));
  const [errors, setErrors] = useState<ZtoReviewErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);

  const setField = (key: keyof ZtoReviewFields, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleAccept = async () => {
    const nextErrors = validateZtoReviewFields(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending("accept");
    setSubmitError("");
    try {
      await acceptZtoReview(normalizeZtoReviewFields(values));
      onResolved("accepted");
    } catch {
      setSubmitError(t.saveFailed);
    } finally {
      setPending(null);
    }
  };

  const handleDecline = async () => {
    setPending("decline");
    setSubmitError("");
    try {
      await declineZtoReview();
      onResolved("declined");
    } catch {
      setSubmitError(t.saveFailed);
    } finally {
      setPending(null);
    }
  };

  const busy = pending !== null;

  const textField = (
    key: keyof ZtoReviewFields,
    label: string,
    options?: { placeholder?: string; inputMode?: "numeric" | "text"; autoComplete?: string },
  ) => (
    <Field data-invalid={!!errors[key]}>
      <FieldLabel htmlFor={`zto-${key}`}>{label}</FieldLabel>
      <Input
        id={`zto-${key}`}
        name={key}
        value={values[key] ?? ""}
        placeholder={options?.placeholder}
        inputMode={options?.inputMode}
        autoComplete={options?.autoComplete ?? "off"}
        disabled={busy}
        aria-invalid={!!errors[key]}
        onChange={(event) => setField(key, event.target.value)}
      />
      <FieldMessage message={errors[key]} />
    </Field>
  );

  return (
    <BrandDialog
      open={open}
      // Intentionally ignore close requests (backdrop, Escape): a decision is required.
      onOpenChange={() => undefined}
      title={t.title}
      maxWidth="lg"
      showCloseButton={false}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4 pt-1">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src={LOOKUP_ILLUSTRATION_SRC}
            alt={t.illustrationAlt}
            width={200}
            height={125}
            sizes="160px"
            className="h-auto w-full max-w-[160px] object-contain"
            priority
          />
          <p className="max-w-sm text-caption leading-relaxed text-muted-foreground">{t.description}</p>
        </div>

        <FieldGroup className="gap-4">
          {textField("name", t.nameLabel, { autoComplete: "name" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("pan", t.panLabel, { placeholder: "ABCDE1234F" })}
            {textField("date_of_birth", t.dobLabel, { placeholder: t.dobPlaceholder })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("bank_account_number", t.bankAccountLabel, { inputMode: "numeric" })}
            {textField("ifsc_code", t.ifscLabel, { placeholder: "HDFC0000001" })}
          </div>
          {textField("address_line", t.addressLabel, { autoComplete: "street-address" })}
          <p className="-mt-2 text-[11px] text-muted-foreground">{t.addressHint}</p>
        </FieldGroup>

        <p className="text-[11px] leading-relaxed text-muted-foreground">{t.footnote}</p>
        {submitError ? <FieldMessage message={submitError} /> : null}
      </div>

      <BrandDialogFooter className="border-t border-border/80">
        <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => void handleDecline()}>
          {pending === "decline" ? t.declining : t.decline}
        </Button>
        <Button type="button" size="lg" disabled={busy} onClick={() => void handleAccept()}>
          {pending === "accept" ? t.accepting : t.accept}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
