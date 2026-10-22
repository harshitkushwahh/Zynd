"use client";

import { Check } from "lucide-react";

import { useZtoSignupConfig } from "@/features/kyc/hooks/use-zto-signup-config";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export function isZtoConsentPairValid(bank: boolean, customer: boolean) {
  return bank === customer;
}

function renderConsent(template: string, partner: string) {
  return template.replace("{partner}", partner);
}

type ConsentCheckboxProps = {
  id: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function ConsentCheckbox({ id, checked, label, onChange }: ConsentCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border px-3.5 py-3 transition-colors",
        checked
          ? "border-primary/35 bg-primary/[0.05] ring-1 ring-primary/15"
          : "border-border bg-muted/20 hover:bg-muted/30",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-control)] border-2 transition-colors",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
        )}
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 text-left text-caption leading-snug text-muted-foreground">{label}</span>
    </label>
  );
}

type ZtoSignupConsentsProps = {
  bankConsent: boolean;
  customerConsent: boolean;
  onBankConsentChange: (checked: boolean) => void;
  onCustomerConsentChange: (checked: boolean) => void;
  /** Prefetch config when the auth dialog opens (signup). */
  prefetch?: boolean;
  idPrefix?: string;
  className?: string;
};

/** Two separate, unchecked-by-default Cybrilla lookup consents. */
export function ZtoSignupConsents({
  bankConsent,
  customerConsent,
  onBankConsentChange,
  onCustomerConsentChange,
  prefetch = true,
  idPrefix = "zto",
  className,
}: ZtoSignupConsentsProps) {
  const { config, uiEnabled, ready } = useZtoSignupConfig(prefetch);

  if (!ready || !uiEnabled || !config) return null;

  const partner = config.partner_name;

  return (
    <div className={cn("space-y-2.5", className)} data-testid="zto-signup-consents">
      <ConsentCheckbox
        id={`${idPrefix}-bank-consent`}
        checked={bankConsent}
        label={config.bank_consent.text || renderConsent(copy.zto.signup.bankConsent, partner)}
        onChange={onBankConsentChange}
      />
      <ConsentCheckbox
        id={`${idPrefix}-customer-consent`}
        checked={customerConsent}
        label={config.customer_consent.text || renderConsent(copy.zto.signup.customerConsent, partner)}
        onChange={onCustomerConsentChange}
      />
    </div>
  );
}
