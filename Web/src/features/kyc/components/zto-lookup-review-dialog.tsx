"use client";

import { Calendar, CreditCard, IdCard, LayoutGrid, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import { ZtoLookupHeroImage } from "@/features/kyc/components/zto-lookup-hero-image";
import { normalizeAccountNumber, normalizeIfscCode } from "@/features/kyc/lib/kyc-bank";
import { acceptZtoReview, declineZtoReview } from "@/features/kyc/lib/zto-api";
import type { ZtoReviewFields } from "@/features/kyc/lib/zto-types";
import {
  normalizeZtoReviewFields,
  validateZtoReviewFields,
  type ZtoReviewErrors,
} from "@/features/kyc/lib/zto-review-validation";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

const EMPTY_FIELDS: ZtoReviewFields = {
  name: "",
  pan: "",
  date_of_birth: "",
  bank_account_number: "",
  ifsc_code: "",
  address_line: "",
};

const INTRO_POINT_ICONS = [
  { icon: Sparkles, iconClassName: "bg-primary/10 text-primary" },
  { icon: ShieldCheck, iconClassName: "bg-success/10 text-success" },
] as const;

type ZtoLookupReviewDialogProps = {
  open: boolean;
  initialFields: ZtoReviewFields | null;
  /** Called after the user explicitly accepts or declines. */
  onResolved: (decision: "accepted" | "declined") => void;
};

/**
 * Non-dismissible confirmation form: same split layout as Add Bank Account.
 * The only exits are Accept and Decline.
 */
const fieldInputClass = "h-11 bg-background";

export function ZtoLookupReviewDialog({ open, initialFields, onResolved }: ZtoLookupReviewDialogProps) {
  const t = copy.zto.review;
  const bankCopy = copy.kyc.bank;
  const [values, setValues] = useState<ZtoReviewFields>(() => ({ ...EMPTY_FIELDS, ...initialFields }));
  const [errors, setErrors] = useState<ZtoReviewErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    if (initialFields) {
      setValues({ ...EMPTY_FIELDS, ...initialFields });
    }
  }, [initialFields]);

  const points = useMemo(
    () =>
      t.introPoints.map((point, index) => ({
        ...point,
        icon: INTRO_POINT_ICONS[index]?.icon ?? Sparkles,
        iconClassName: INTRO_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
      })),
    [t.introPoints],
  );

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

  const iconField = (
    key: keyof ZtoReviewFields,
    label: string,
    icon: typeof UserRound,
    options?: {
      placeholder?: string;
      inputMode?: "numeric" | "text";
      autoComplete?: string;
      inputClassName?: string;
      normalize?: (value: string) => string;
    },
  ) => {
    const Icon = icon;
    return (
      <div className="space-y-2">
        <Label htmlFor={`zto-${key}`}>{label}</Label>
        <div className="relative min-w-0">
          <Icon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={`zto-${key}`}
            name={key}
            value={values[key] ?? ""}
            placeholder={options?.placeholder}
            inputMode={options?.inputMode}
            autoComplete={options?.autoComplete ?? "off"}
            disabled={busy}
            aria-invalid={!!errors[key]}
            className={cn(fieldInputClass, "pl-9", options?.inputClassName)}
            onChange={(event) => {
              const raw = event.target.value;
              setField(key, options?.normalize ? options.normalize(raw) : raw);
            }}
          />
        </div>
        {errors[key] ? <FieldMessage message={errors[key]} /> : null}
      </div>
    );
  };

  return (
    <SplitFormDialog
      open={open}
      onOpenChange={() => undefined}
      dismissible={false}
      showCloseButton={false}
      title={t.title}
      heading={t.title}
      illustration={<ZtoLookupHeroImage className="w-full max-w-sm" alt={t.illustrationAlt} />}
      points={points}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={busy}
            onClick={() => void handleDecline()}
          >
            {pending === "decline" ? t.declining : t.decline}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full px-5"
            disabled={busy}
            onClick={() => void handleAccept()}
          >
            {pending === "accept" ? t.accepting : t.accept}
          </Button>
        </>
      }
    >
      <div className="min-w-0 space-y-4">
        <div className="space-y-4">
          {iconField("name", t.nameLabel, UserRound, { autoComplete: "name" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {iconField("pan", t.panLabel, IdCard, {
              placeholder: "ABCDE1234F",
              inputClassName: "uppercase tracking-wide",
              normalize: (value) => value.toUpperCase(),
            })}
            {iconField("date_of_birth", t.dobLabel, Calendar, { placeholder: t.dobPlaceholder })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {iconField("bank_account_number", bankCopy.fields.accountNumber, CreditCard, {
              inputMode: "numeric",
              placeholder: bankCopy.placeholders.accountNumber,
              normalize: normalizeAccountNumber,
            })}
            {iconField("ifsc_code", bankCopy.fields.ifscCode, LayoutGrid, {
              placeholder: bankCopy.placeholders.enterIfscCode,
              inputClassName: "font-mono uppercase tracking-wide",
              normalize: normalizeIfscCode,
            })}
          </div>
          {iconField("address_line", t.addressLabel, MapPin, { autoComplete: "street-address" })}
        </div>

        {submitError ? <FieldMessage message={submitError} /> : null}
      </div>
    </SplitFormDialog>
  );
}
