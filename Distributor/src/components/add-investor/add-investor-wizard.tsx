"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Loader2,
  QrCode,
  UserPlus,
} from "lucide-react";

import { AddInvestorOtpField } from "@/components/add-investor/add-investor-otp-field";
import { AddInvestorVerifyChannel } from "@/components/add-investor/add-investor-verify-channel";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ADD_INVESTOR_DEMO_OTP,
  ADD_INVESTOR_PERSONAL_OPTIONS,
  addInvestorStepIndex,
  buildAddInvestorJourneySteps,
  emptyAddressDraft,
  emptyPersonalDraft,
  type AddInvestorAddressDraft,
  type AddInvestorPanName,
  type AddInvestorPersonalDraft,
  type AddInvestorReadiness,
  type AddInvestorStepId,
} from "@/lib/add-investor/add-investor-journey";
import {
  delay,
  DIGILOCKER_PREFILL_ADDRESS,
  normalizeMobileInput,
  normalizePanInput,
  verifyDemoPan,
} from "@/lib/add-investor/add-investor-demo";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { YOUR_CLIENTS_LIST_HREF } from "@/lib/distributor-client-routes";
import { formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function ReadinessBadge({ readiness }: { readiness: AddInvestorReadiness }) {
  const isKra = readiness.code === "kyc_registered";
  return (
    <div
      className={cn(
        "add-investor-readiness",
        isKra ? "add-investor-readiness--kra" : "add-investor-readiness--new",
      )}
    >
      <p className="add-investor-readiness__label">{readiness.label}</p>
      <p className="add-investor-readiness__hint">{readiness.hint}</p>
    </div>
  );
}

export function AddInvestorWizard() {
  const router = useRouter();
  const [stepId, setStepId] = useState<AddInvestorStepId>("email");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBound, setMfaBound] = useState(false);
  const [pan, setPan] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [panVerified, setPanVerified] = useState(false);
  const [panName, setPanName] = useState<AddInvestorPanName | null>(null);
  const [readiness, setReadiness] = useState<AddInvestorReadiness | null>(null);
  const [requiresDigilocker, setRequiresDigilocker] = useState<boolean | null>(null);
  const [panError, setPanError] = useState("");
  const [panLoading, setPanLoading] = useState(false);
  const [digilockerLoading, setDigilockerLoading] = useState(false);
  const [digilockerDone, setDigilockerDone] = useState(false);
  const [address, setAddress] = useState<AddInvestorAddressDraft>(emptyAddressDraft());
  const [addressFromDigilocker, setAddressFromDigilocker] = useState(false);
  const [personal, setPersonal] = useState<AddInvestorPersonalDraft>(emptyPersonalDraft());
  const [submitting, setSubmitting] = useState(false);

  const journeySteps = useMemo(
    () => buildAddInvestorJourneySteps(requiresDigilocker ?? true),
    [requiresDigilocker],
  );

  const currentIndex = addInvestorStepIndex(journeySteps, stepId);
  const journeyProgressPct =
    journeySteps.length > 0
      ? Math.round(((Math.max(currentIndex, 0) + 1) / journeySteps.length) * 100)
      : 0;

  const goToStep = (id: AddInvestorStepId) => setStepId(id);

  const goNext = () => {
    const idx = addInvestorStepIndex(journeySteps, stepId);
    if (idx >= 0 && idx < journeySteps.length - 1) {
      setStepId(journeySteps[idx + 1].id);
    }
  };

  const goBack = () => {
    const idx = addInvestorStepIndex(journeySteps, stepId);
    if (idx > 0) {
      setStepId(journeySteps[idx - 1].id);
    }
  };

  const canContinue = (() => {
    switch (stepId) {
      case "email":
        return isValidEmail(email) && emailOtp === ADD_INVESTOR_DEMO_OTP;
      case "mobile":
        return mobile.length === 10 && mobileOtp === ADD_INVESTOR_DEMO_OTP;
      case "mfa":
        return mfaBound && mfaCode.length === 6;
      case "pan":
        return panVerified && Boolean(panName);
      case "digilocker":
        return digilockerDone;
      case "address":
        return (
          address.line1.trim().length > 2 &&
          address.city.trim().length > 1 &&
          address.state.trim().length > 1 &&
          address.pincode.length === 6
        );
      case "personal-info":
        return (
          Boolean(personal.gender) &&
          Boolean(personal.maritalStatus) &&
          Boolean(personal.occupation) &&
          Boolean(personal.incomeSlab) &&
          Boolean(personal.pepExposed) &&
          personal.placeOfBirth.trim().length > 1
        );
      case "review":
        return true;
      default:
        return false;
    }
  })();

  const handleVerifyPan = async () => {
    setPanError("");
    setPanLoading(true);
    await delay(700);
    const result = verifyDemoPan(pan);
    setPanLoading(false);
    if (!result.ok) {
      setPanError(result.error);
      setPanVerified(false);
      setPanName(null);
      setReadiness(null);
      return;
    }
    setPanName(result.panName);
    setReadiness(result.readiness);
    setRequiresDigilocker(!result.kycAlreadyRegistered);
    setPanVerified(true);
  };

  const handlePanContinue = () => {
    if (!panVerified) return;
    if (requiresDigilocker) {
      goToStep("digilocker");
    } else {
      setAddress(emptyAddressDraft());
      setAddressFromDigilocker(false);
      goToStep("address");
    }
  };

  const handleDigilockerConnect = async () => {
    setDigilockerLoading(true);
    await delay(1200);
    setAddress({ ...DIGILOCKER_PREFILL_ADDRESS });
    setAddressFromDigilocker(true);
    setDigilockerDone(true);
    setDigilockerLoading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await delay(600);
    setSubmitting(false);
    router.push(YOUR_CLIENTS_LIST_HREF);
  };

  const updateAddress = (patch: Partial<AddInvestorAddressDraft>) => {
    setAddress((current) => ({ ...current, ...patch }));
  };

  const updatePersonal = (patch: Partial<AddInvestorPersonalDraft>) => {
    setPersonal((current) => ({ ...current, ...patch }));
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        icon={UserPlus}
        title="Add investor"
        description="Guided onboarding — account verification, MFA, PAN, and KYC aligned with the investor web app."
      />

      <div className="quick-txn-wizard add-investor-wizard">
        <nav className="quick-txn-wizard__journey" aria-label="Add investor journey">
          <div className="quick-txn-journey-header">
            <div>
              <p className="quick-txn-journey-header__title">Investor journey</p>
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
                      <CheckCircle2 className="quick-txn-journey-step__done-icon size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="quick-txn-wizard__panel">
          {stepId === "email" ? <AddInvestorVerifyChannel channel="email" value={email} onValueChange={setEmail} otp={emailOtp} onOtpChange={setEmailOtp} inputValid={isValidEmail(email)} /> : null}

          {stepId === "mobile" ? (
            <AddInvestorVerifyChannel
              channel="mobile"
              value={mobile}
              onValueChange={(value) => setMobile(normalizeMobileInput(value))}
              otp={mobileOtp}
              onOtpChange={setMobileOtp}
              inputValid={mobile.length === 10}
            />
          ) : null}

          {stepId === "mfa" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Authenticator app</h2>
              <p className="quick-txn-wizard__section-desc">
                Required before KYC (same gate as the investor web app). Scan the QR code, then enter a 6-digit
                code.
              </p>
              <div className="add-investor-mfa">
                <div className="add-investor-mfa__qr" aria-hidden>
                  <QrCode className="size-16 text-muted-foreground/70" strokeWidth={1.25} />
                </div>
                <div className="add-investor-mfa__meta">
                  <p className="text-compact font-medium text-foreground">Demo secret</p>
                  <p className="font-mono text-caption text-muted-foreground">ZYND-DIST-DEMO-MFA-KEY</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Switch
                      id="add-investor-mfa-bound"
                      checked={mfaBound}
                      onCheckedChange={setMfaBound}
                    />
                    <Label htmlFor="add-investor-mfa-bound" className="text-caption">
                      I added this account to my authenticator
                    </Label>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <FieldLabel>Authenticator code</FieldLabel>
                <AddInvestorOtpField
                  id="add-investor-mfa-otp"
                  value={mfaCode}
                  onChange={setMfaCode}
                  disabled={!mfaBound}
                />
              </div>
            </div>
          ) : null}

          {stepId === "pan" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">PAN verification</h2>
              <p className="quick-txn-wizard__section-desc">
                Name is fetched via Kyckart after PAN validation — same as web KYC. Try{" "}
                <span className="font-mono">ABCPK1234A</span> (KRA registered) or{" "}
                <span className="font-mono">ABCPN1234A</span> (new to KYC).
              </p>
              {readiness ? <ReadinessBadge readiness={readiness} /> : null}
              <div className="add-investor-pan-card">
                <p className="add-investor-pan-card__label">Name from registry</p>
                {panVerified && panName ? (
                  <div className="add-investor-pan-card__name">
                    <p className="text-body font-semibold text-foreground">
                      {panName.firstName} {middleName ? `${middleName} ` : ""}
                      {panName.lastName}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      DOB {formatDistributorDate(panName.dateOfBirth)} · {panName.panCategory}
                    </p>
                  </div>
                ) : (
                  <p className="text-caption text-muted-foreground">
                    Verify PAN to fetch investor name from Kyckart.
                  </p>
                )}
              </div>
              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel htmlFor="add-investor-pan">PAN</FieldLabel>
                  <Input
                    id="add-investor-pan"
                    value={pan}
                    onChange={(event) => {
                      setPan(normalizePanInput(event.target.value));
                      setPanVerified(false);
                      setPanName(null);
                      setReadiness(null);
                      setRequiresDigilocker(null);
                    }}
                    placeholder="ABCPK1234A"
                    className="font-mono uppercase"
                  />
                  {panError ? <p className="text-caption text-destructive">{panError}</p> : null}
                </Field>
                {panVerified ? (
                  <Field>
                    <FieldLabel htmlFor="add-investor-middle">Middle name (optional)</FieldLabel>
                    <Input
                      id="add-investor-middle"
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                    />
                  </Field>
                ) : null}
              </FieldGroup>
              {!panVerified ? (
                <Button type="button" className="mt-4" disabled={pan.length !== 10 || panLoading} onClick={handleVerifyPan}>
                  {panLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Fetching name…
                    </>
                  ) : (
                    "Verify PAN & fetch name"
                  )}
                </Button>
              ) : null}
            </div>
          ) : null}

          {stepId === "digilocker" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">DigiLocker</h2>
              <p className="quick-txn-wizard__section-desc">
                New-to-KYC investors complete Aadhaar fetch through DigiLocker before address review.
              </p>
              <div className="add-investor-digilocker">
                <p className="text-compact font-medium text-foreground">Connect DigiLocker</p>
                <p className="mt-1 text-caption text-muted-foreground">
                  Demo flow simulates redirect and prefills permanent address from Aadhaar.
                </p>
                <Button
                  type="button"
                  className="mt-4"
                  disabled={digilockerLoading || digilockerDone}
                  onClick={handleDigilockerConnect}
                >
                  {digilockerLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Connecting…
                    </>
                  ) : digilockerDone ? (
                    "DigiLocker connected"
                  ) : (
                    "Continue with DigiLocker"
                  )}
                </Button>
                {digilockerDone ? (
                  <p className="mt-3 text-caption text-emerald-700 dark:text-emerald-400">
                    Address fetched — continue to review prefilled address.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {stepId === "address" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Address</h2>
              <p className="quick-txn-wizard__section-desc">
                {addressFromDigilocker
                  ? "Prefilled from DigiLocker — same as web KYC after Aadhaar fetch."
                  : "KRA-registered path — enter permanent address manually (DigiLocker skipped)."}
              </p>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="addr-line1">Address line 1</FieldLabel>
                  <Input
                    id="addr-line1"
                    value={address.line1}
                    readOnly={addressFromDigilocker}
                    onChange={(e) => updateAddress({ line1: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="addr-line2">Address line 2</FieldLabel>
                  <Input
                    id="addr-line2"
                    value={address.line2}
                    readOnly={addressFromDigilocker}
                    onChange={(e) => updateAddress({ line2: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="addr-city">City</FieldLabel>
                    <Input
                      id="addr-city"
                      value={address.city}
                      readOnly={addressFromDigilocker}
                      onChange={(e) => updateAddress({ city: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="addr-state">State</FieldLabel>
                    <Input
                      id="addr-state"
                      value={address.state}
                      readOnly={addressFromDigilocker}
                      onChange={(e) => updateAddress({ state: e.target.value })}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="addr-pin">PIN code</FieldLabel>
                  <Input
                    id="addr-pin"
                    inputMode="numeric"
                    maxLength={6}
                    value={address.pincode}
                    readOnly={addressFromDigilocker}
                    onChange={(e) => updateAddress({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Switch
                    id="addr-same"
                    checked={address.correspondenceSame}
                    onCheckedChange={(checked) => updateAddress({ correspondenceSame: checked })}
                  />
                  <Label htmlFor="addr-same" className="text-caption">
                    Correspondence address same as permanent
                  </Label>
                </div>
              </FieldGroup>
            </div>
          ) : null}

          {stepId === "personal-info" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Personal & compliance</h2>
              <p className="quick-txn-wizard__section-desc">
                PEP, income, and occupation — aligned with web KYC personal info step.
              </p>
              <FieldGroup>
                <Field>
                  <FieldLabel>Gender</FieldLabel>
                  <Select value={personal.gender} onValueChange={(v) => updatePersonal({ gender: v ?? "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADD_INVESTOR_PERSONAL_OPTIONS.gender.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Marital status</FieldLabel>
                  <Select
                    value={personal.maritalStatus}
                    onValueChange={(v) => updatePersonal({ maritalStatus: v ?? "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADD_INVESTOR_PERSONAL_OPTIONS.maritalStatus.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Occupation</FieldLabel>
                  <Select value={personal.occupation} onValueChange={(v) => updatePersonal({ occupation: v ?? "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select occupation" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADD_INVESTOR_PERSONAL_OPTIONS.occupation.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Income slab</FieldLabel>
                  <Select value={personal.incomeSlab} onValueChange={(v) => updatePersonal({ incomeSlab: v ?? "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select income" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADD_INVESTOR_PERSONAL_OPTIONS.incomeSlab.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Politically exposed person (PEP)</FieldLabel>
                  <Select value={personal.pepExposed} onValueChange={(v) => updatePersonal({ pepExposed: v ?? "no" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADD_INVESTOR_PERSONAL_OPTIONS.pepExposed.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pob">Place of birth</FieldLabel>
                  <Input
                    id="pob"
                    value={personal.placeOfBirth}
                    onChange={(e) => updatePersonal({ placeOfBirth: e.target.value })}
                    placeholder="City, state"
                  />
                </Field>
              </FieldGroup>
            </div>
          ) : null}

          {stepId === "review" ? (
            <div className="quick-txn-wizard__section">
              <h2 className="quick-txn-wizard__section-title">Review & invite</h2>
              <p className="quick-txn-wizard__section-desc">
                Confirm details before sending the investor invite (demo — no API calls).
              </p>
              <dl className="add-investor-review">
                <div className="add-investor-review__row">
                  <dt>Email</dt>
                  <dd>{email}</dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Mobile</dt>
                  <dd>+91 {mobile}</dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>MFA</dt>
                  <dd>Authenticator enrolled</dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>PAN / name</dt>
                  <dd>
                    {pan} · {panName?.firstName} {panName?.lastName}
                  </dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>KYC path</dt>
                  <dd>{requiresDigilocker ? "DigiLocker + address" : "KRA — manual address"}</dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Address</dt>
                  <dd>
                    {address.line1}, {address.city}, {address.state} {address.pincode}
                  </dd>
                </div>
                <div className="add-investor-review__row">
                  <dt>Compliance</dt>
                  <dd>
                    {personal.occupation}, {personal.incomeSlab}, PEP: {personal.pepExposed}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="quick-txn-wizard__footer">
            <Button type="button" variant="outline" onClick={goBack} disabled={currentIndex <= 0}>
              Back
            </Button>
            {stepId === "pan" && panVerified ? (
              <Button type="button" onClick={handlePanContinue}>
                Continue
              </Button>
            ) : stepId === "review" ? (
              <Button type="button" disabled={submitting} onClick={handleSubmit}>
                {submitting ? "Sending invite…" : "Send investor invite"}
              </Button>
            ) : stepId === "pan" ? (
              <Button type="button" disabled>
                Continue
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
