"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, CheckCircle2, Loader2 } from "lucide-react";

import { AddDistributorDocumentUpload } from "@/components/add-distributor/add-distributor-document-upload";
import { AddInvestorVerifyChannel } from "@/components/add-investor/add-investor-verify-channel";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ADD_DISTRIBUTOR_DEMO_OTP,
  ADD_DISTRIBUTOR_JOURNEY_STEPS,
  addDistributorStepIndex,
  emptyAddressDraft,
  emptyBankDraft,
  emptyDocumentDraft,
  emptyNameDraft,
  type AddDistributorAddressDraft,
  type AddDistributorBankDraft,
  type AddDistributorDocumentDraft,
  type AddDistributorNameDraft,
  type AddDistributorStepId,
} from "@/lib/add-distributor/add-distributor-journey";
import { ADD_INVESTOR_DEMO_OTP } from "@/lib/add-investor/add-investor-journey";
import { delay, normalizeMobileInput } from "@/lib/add-investor/add-investor-demo";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim().toUpperCase());
}

function formatFullName(name: AddDistributorNameDraft): string {
  return [name.firstName, name.middleName, name.lastName].filter(Boolean).join(" ").trim();
}

export function AddDistributorWizard() {
  const router = useRouter();
  const { branchLabel } = useDistributorAuth();

  const [stepId, setStepId] = useState<AddDistributorStepId>("email");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [name, setName] = useState<AddDistributorNameDraft>(emptyNameDraft());
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [bank, setBank] = useState<AddDistributorBankDraft>(emptyBankDraft());
  const [address, setAddress] = useState<AddDistributorAddressDraft>(emptyAddressDraft());
  const [documents, setDocuments] = useState<AddDistributorDocumentDraft>(emptyDocumentDraft());
  const [submitting, setSubmitting] = useState(false);

  const journeySteps = ADD_DISTRIBUTOR_JOURNEY_STEPS;
  const currentIndex = addDistributorStepIndex(stepId);
  const journeyProgressPct =
    journeySteps.length > 0
      ? Math.round(((Math.max(currentIndex, 0) + 1) / journeySteps.length) * 100)
      : 0;

  const goToStep = (id: AddDistributorStepId) => setStepId(id);

  const goNext = () => {
    const idx = addDistributorStepIndex(stepId);
    if (idx >= 0 && idx < journeySteps.length - 1) {
      const nextId = journeySteps[idx + 1].id;
      if (nextId === "bank" && !bank.accountHolderName.trim()) {
        setBank((current) => ({
          ...current,
          accountHolderName: formatFullName(name),
        }));
      }
      setStepId(nextId);
    }
  };

  const goBack = () => {
    const idx = addDistributorStepIndex(stepId);
    if (idx > 0) {
      setStepId(journeySteps[idx - 1].id);
    }
  };

  const canContinue = (() => {
    switch (stepId) {
      case "email":
        return isValidEmail(email) && emailOtp === ADD_INVESTOR_DEMO_OTP;
      case "name":
        return name.firstName.trim().length >= 2 && name.lastName.trim().length >= 2;
      case "mobile":
        return mobile.length === 10 && mobileOtp === ADD_DISTRIBUTOR_DEMO_OTP;
      case "bank": {
        const acct = bank.accountNumber.replace(/\D/g, "");
        const confirm = bank.confirmAccountNumber.replace(/\D/g, "");
        return (
          bank.accountHolderName.trim().length >= 3 &&
          acct.length >= 9 &&
          acct === confirm &&
          isValidIfsc(bank.ifsc) &&
          bank.bankName.trim().length >= 2
        );
      }
      case "address":
        return (
          address.line1.trim().length > 2 &&
          address.city.trim().length > 1 &&
          address.state.trim().length > 1 &&
          address.pincode.length === 6
        );
      case "documents":
        return Boolean(documents.panFileName && documents.aadharFileName);
      case "review":
        return true;
      default:
        return false;
    }
  })();

  const reviewEmail = useMemo(() => email.trim(), [email]);

  const updateName = (patch: Partial<AddDistributorNameDraft>) => {
    setName((current) => ({ ...current, ...patch }));
  };

  const updateBank = (patch: Partial<AddDistributorBankDraft>) => {
    setBank((current) => ({ ...current, ...patch }));
  };

  const updateAddress = (patch: Partial<AddDistributorAddressDraft>) => {
    setAddress((current) => ({ ...current, ...patch }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await delay(800);
    setSubmitting(false);
    router.push("/dashboard/dist-management/distributors");
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        icon={Building2}
        title="Add distributor"
        description={`Onboard a new distributor to ${branchLabel}. ARN registration, bank, and compliance checks (demo wizard).`}
      />

      <div className="quick-txn-wizard add-investor-wizard">
        <nav className="quick-txn-wizard__journey" aria-label="Add distributor journey">
          <div className="quick-txn-journey-header">
            <div>
              <p className="quick-txn-journey-header__title">Distributor onboarding</p>
              <p className="quick-txn-journey-header__meta">
                Step {Math.max(currentIndex, 0) + 1} of {journeySteps.length}
              </p>
            </div>
            <span className="quick-txn-journey-header__pct">{journeyProgressPct}%</span>
          </div>
          <div
            className="quick-txn-journey-progress"
            role="progressbar"
            aria-valuenow={journeyProgressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="quick-txn-journey-progress__bar" style={{ width: `${journeyProgressPct}%` }} />
          </div>
          <ol className="quick-txn-journey-steps">
            {journeySteps.map((item, index) => {
              const done = index < currentIndex;
              const active = item.id === stepId;
              const upcoming = index > currentIndex;
              const StepIcon = item.icon;
              const navigable = index <= currentIndex;

              return (
                <li
                  key={item.id}
                  className={cn(
                    "quick-txn-journey-step",
                    active && "quick-txn-journey-step--active",
                    done && "quick-txn-journey-step--done",
                    upcoming && "quick-txn-journey-step--upcoming",
                  )}
                >
                  <div className="quick-txn-journey-step__rail" aria-hidden>
                    <span className="quick-txn-journey-step__marker">
                      {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                    </span>
                    {index < journeySteps.length - 1 ? (
                      <span
                        className={cn(
                          "quick-txn-journey-step__line",
                          done && "quick-txn-journey-step__line--done",
                        )}
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="quick-txn-journey-step__body"
                    disabled={!navigable}
                    aria-current={active ? "step" : undefined}
                    onClick={() => {
                      if (navigable) goToStep(item.id);
                    }}
                  >
                    <span className="quick-txn-journey-step__icon" aria-hidden>
                      <StepIcon className="size-4" strokeWidth={active ? 2.25 : 2} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="quick-txn-journey-step__label">{item.label}</span>
                      <span className="quick-txn-journey-step__desc">{item.description}</span>
                    </span>
                    {active ? (
                      <span className="quick-txn-journey-step__pill">Current</span>
                    ) : done ? (
                      <CheckCircle2
                        className="quick-txn-journey-step__done-icon size-4 shrink-0"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="quick-txn-wizard__panel">
          {stepId === "email" ? (
            <AddInvestorVerifyChannel
              channel="email"
              audience="distributor"
              value={email}
              onValueChange={setEmail}
              otp={emailOtp}
              onOtpChange={setEmailOtp}
              inputValid={isValidEmail(email)}
            />
          ) : null}

          {stepId === "name" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Distributor name</h2>
              <p className="quick-txn-wizard__section-desc">
                Legal name as it will appear on ARN records and commission payouts.
              </p>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="dist-first-name">First name</FieldLabel>
                  <Input
                    id="dist-first-name"
                    autoComplete="given-name"
                    value={name.firstName}
                    onChange={(event) => updateName({ firstName: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dist-middle-name">Middle name (optional)</FieldLabel>
                  <Input
                    id="dist-middle-name"
                    autoComplete="additional-name"
                    value={name.middleName}
                    onChange={(event) => updateName({ middleName: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dist-last-name">Last name</FieldLabel>
                  <Input
                    id="dist-last-name"
                    autoComplete="family-name"
                    value={name.lastName}
                    onChange={(event) => updateName({ lastName: event.target.value })}
                  />
                </Field>
              </FieldGroup>
            </div>
          ) : null}

          {stepId === "mobile" ? (
            <AddInvestorVerifyChannel
              channel="mobile"
              audience="distributor"
              value={mobile}
              onValueChange={(value) => setMobile(normalizeMobileInput(value))}
              otp={mobileOtp}
              onOtpChange={setMobileOtp}
              inputValid={mobile.length === 10}
            />
          ) : null}

          {stepId === "bank" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Bank account</h2>
              <p className="quick-txn-wizard__section-desc">
                Settlement account for trail and upfront commissions. Must match KYC name where possible.
              </p>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="dist-bank-holder">Account holder name</FieldLabel>
                  <Input
                    id="dist-bank-holder"
                    value={bank.accountHolderName}
                    onChange={(event) => updateBank({ accountHolderName: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dist-bank-name">Bank name</FieldLabel>
                  <Input
                    id="dist-bank-name"
                    placeholder="e.g. HDFC Bank"
                    value={bank.bankName}
                    onChange={(event) => updateBank({ bankName: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dist-account">Account number</FieldLabel>
                  <Input
                    id="dist-account"
                    inputMode="numeric"
                    autoComplete="off"
                    value={bank.accountNumber}
                    onChange={(event) =>
                      updateBank({ accountNumber: event.target.value.replace(/\D/g, "").slice(0, 18) })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dist-account-confirm">Confirm account number</FieldLabel>
                  <Input
                    id="dist-account-confirm"
                    inputMode="numeric"
                    autoComplete="off"
                    value={bank.confirmAccountNumber}
                    onChange={(event) =>
                      updateBank({
                        confirmAccountNumber: event.target.value.replace(/\D/g, "").slice(0, 18),
                      })
                    }
                  />
                  {bank.confirmAccountNumber &&
                  bank.accountNumber !== bank.confirmAccountNumber ? (
                    <p className="text-caption text-destructive">Account numbers do not match.</p>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="dist-ifsc">IFSC</FieldLabel>
                  <Input
                    id="dist-ifsc"
                    value={bank.ifsc}
                    onChange={(event) =>
                      updateBank({ ifsc: event.target.value.toUpperCase().replace(/\s/g, "").slice(0, 11) })
                    }
                    placeholder="HDFC0001234"
                    className="font-mono uppercase"
                  />
                </Field>
              </FieldGroup>
            </div>
          ) : null}

          {stepId === "address" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Registered address</h2>
              <p className="quick-txn-wizard__section-desc">
                Office or correspondence address for branch records and AMFI compliance.
              </p>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="dist-addr-line1">Address line 1</FieldLabel>
                  <Input
                    id="dist-addr-line1"
                    value={address.line1}
                    onChange={(event) => updateAddress({ line1: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dist-addr-line2">Address line 2 (optional)</FieldLabel>
                  <Input
                    id="dist-addr-line2"
                    value={address.line2}
                    onChange={(event) => updateAddress({ line2: event.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="dist-addr-city">City</FieldLabel>
                    <Input
                      id="dist-addr-city"
                      value={address.city}
                      onChange={(event) => updateAddress({ city: event.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="dist-addr-state">State</FieldLabel>
                    <Input
                      id="dist-addr-state"
                      value={address.state}
                      onChange={(event) => updateAddress({ state: event.target.value })}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="dist-addr-pin">PIN code</FieldLabel>
                  <Input
                    id="dist-addr-pin"
                    inputMode="numeric"
                    maxLength={6}
                    value={address.pincode}
                    onChange={(event) =>
                      updateAddress({ pincode: event.target.value.replace(/\D/g, "").slice(0, 6) })
                    }
                  />
                </Field>
              </FieldGroup>
            </div>
          ) : null}

          {stepId === "documents" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Upload PAN & Aadhaar</h2>
              <p className="quick-txn-wizard__section-desc">
                Clear scans or PDFs for compliance review before ARN activation (demo — files stay on device).
              </p>
              <div className="add-distributor-docs">
                <AddDistributorDocumentUpload
                  id="dist-doc-pan"
                  label="PAN card"
                  description="Permanent Account Number proof"
                  fileName={documents.panFileName}
                  onFileSelect={(panFileName) => setDocuments((current) => ({ ...current, panFileName }))}
                />
                <AddDistributorDocumentUpload
                  id="dist-doc-aadhar"
                  label="Aadhaar card"
                  description="Identity & address verification"
                  fileName={documents.aadharFileName}
                  onFileSelect={(aadharFileName) =>
                    setDocuments((current) => ({ ...current, aadharFileName }))
                  }
                />
              </div>
            </div>
          ) : null}

          {stepId === "review" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Review & submit</h2>
              <p className="quick-txn-wizard__section-desc">
                Branch manager submits the pack for HO compliance and ARN provisioning (demo).
              </p>
              <dl className="add-investor-review">
                <div className="add-investor-review__row">
                  <dt>Branch</dt>
                  <dd>{branchLabel}</dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Email</dt>
                  <dd>{reviewEmail}</dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Name</dt>
                  <dd>{formatFullName(name)}</dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Mobile</dt>
                  <dd>+91 {mobile}</dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Bank</dt>
                  <dd>
                    {bank.bankName} · ****{bank.accountNumber.slice(-4)} · {bank.ifsc}
                  </dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Address</dt>
                  <dd>
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state}{" "}
                    {address.pincode}
                  </dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Documents</dt>
                  <dd>
                    PAN: {documents.panFileName ?? "—"} · Aadhaar: {documents.aadharFileName ?? "—"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="quick-txn-wizard__footer">
            <Button type="button" variant="outline" onClick={goBack} disabled={currentIndex <= 0}>
              Back
            </Button>
            {stepId === "review" ? (
              <Button type="button" disabled={submitting} onClick={handleSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  "Submit distributor"
                )}
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={!canContinue}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
