"use client";

import {
  AuthSubmitFooter,
  EmailChip,
  MobileChip,
  OtpInfoBanner,
  OtpInput,
  PasswordCriteriaList,
  ProfileNameHeader,
  profileInputClass,
  stepPanelClass,
  underlineInputClass,
} from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { IndiaFlagIcon } from "@/components/auth/india-flag-icon";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuthDialogFlow } from "@/features/auth/hooks/auth-dialog-flow";
import { isProfileValid, isValidMobile, isValidOtp } from "@/lib/auth-validation";
import { clampToMaxLength, digitsOnly, inputRuleProps, lettersOnly } from "@/lib/input-rules";
import { isPasswordValid } from "@/lib/password-criteria";
import { copy } from "@/shared/config/copy";

export function AuthEmailOtpStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    email,
    setStep,
    emailOtp,
    setEmailOtp,
    emailOtpError,
    setEmailOtpError,
    isSubmitting,
    emailOtpCooldown,
    handleEmailOtpContinue,
    handleResendEmailOtp,
  } = flow;

  return (
    <form onSubmit={handleEmailOtpContinue} className={stepPanelClass(step === "email-otp")}>
      <EmailChip email={email} onEdit={() => setStep("email")} />
      <OtpInfoBanner
        message={copy.auth.joinEmailOtpMessage(email)}
        resend={{
          canResend: emailOtpCooldown.canResend,
          secondsLeft: emailOtpCooldown.secondsLeft,
          onResend: () => void handleResendEmailOtp(),
          disabled: isSubmitting,
        }}
      />
      <OtpInput
        id="emailOtp"
        value={emailOtp}
        error={!!emailOtpError}
        onChange={(value) => {
          setEmailOtp(value);
          if (emailOtpError) setEmailOtpError("");
        }}
      />
      <FieldMessage message={emailOtpError} />
      <AuthSubmitFooter>
        <Button
          type="submit"
          size="auth"
          disabled={!isValidOtp(emailOtp)}
        >
          {copy.auth.joinButton}
        </Button>
      </AuthSubmitFooter>
    </form>
  );
}

export function AuthPasswordStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    email,
    setStep,
    password,
    setPassword,
    passwordError,
    setPasswordError,
    handlePasswordContinue,
  } = flow;

  return (
    <form onSubmit={handlePasswordContinue} className={stepPanelClass(step === "password")}>
      <EmailChip email={email} onEdit={() => setStep("email")} />
      <div className="flex min-h-0 flex-1 flex-col justify-end">
        <PasswordInput
          name="password"
          autoComplete="new-password"
          placeholder="Create your password"
          required
          value={password}
          onChange={(event) => {
            setPassword(clampToMaxLength(event.target.value, "password"));
            if (passwordError) setPasswordError("");
          }}
          aria-invalid={!!passwordError}
          className={underlineInputClass}
          {...inputRuleProps("password")}
        />
        <FieldMessage message={passwordError} />
        <PasswordCriteriaList password={password} />
        <AuthSubmitFooter className="mt-4">
          <Button
            type="submit"
            size="auth"
            disabled={!isPasswordValid(password)}
          >
            Continue
          </Button>
        </AuthSubmitFooter>
      </div>
    </form>
  );
}

export function AuthMobileStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    email,
    setStep,
    mobile,
    setMobile,
    mobileError,
    setMobileError,
    defaultCountry,
    handleMobileContinue,
  } = flow;

  return (
    <form onSubmit={handleMobileContinue} className={stepPanelClass(step === "mobile")}>
      <EmailChip email={email} onEdit={() => setStep("email")} />
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="country">Country</FieldLabel>
          <div className="flex h-11 items-center gap-2.5 rounded-[var(--radius-control)] border border-border bg-muted/30 px-3 text-compact text-foreground">
            <IndiaFlagIcon />
            <span>
              {defaultCountry.label} ({defaultCountry.dialCode})
            </span>
          </div>
        </Field>
        <Field data-invalid={!!mobileError}>
          <FieldLabel htmlFor="mobile">Mobile number</FieldLabel>
          <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-muted/20 px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
            <span className="shrink-0 text-compact font-medium text-muted-foreground">
              {defaultCountry.dialCode}
            </span>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              autoComplete="tel-national"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              required
              value={mobile}
              onChange={(event) => {
                setMobile(digitsOnly(event.target.value, "mobile"));
                if (mobileError) setMobileError("");
              }}
              aria-invalid={!!mobileError}
              className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              {...inputRuleProps("mobile")}
            />
          </div>
          <FieldMessage message={mobileError} />
        </Field>
      </FieldGroup>
      <AuthSubmitFooter>
        <Button
          type="submit"
          size="auth"
          disabled={!isValidMobile(mobile)}
        >
          Send OTP
        </Button>
      </AuthSubmitFooter>
    </form>
  );
}

export function AuthMobileOtpStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    email,
    mobile,
    setStep,
    mobileOtp,
    setMobileOtp,
    mobileOtpError,
    setMobileOtpError,
    isSubmitting,
    mobileOtpCooldown,
    handleMobileOtpContinue,
    handleResendMobileOtp,
  } = flow;

  return (
    <form onSubmit={handleMobileOtpContinue} className={stepPanelClass(step === "mobile-otp")}>
      <EmailChip email={email} onEdit={() => setStep("email")} />
      <MobileChip mobile={mobile} onEdit={() => setStep("mobile")} />
      <OtpInfoBanner
        message={copy.auth.otpMobileBanner}
        resend={{
          canResend: mobileOtpCooldown.canResend,
          secondsLeft: mobileOtpCooldown.secondsLeft,
          onResend: () => void handleResendMobileOtp(),
          disabled: isSubmitting,
          readyLabel: "Resend OTP",
        }}
      />
      <OtpInput
        id="mobileOtp"
        value={mobileOtp}
        error={!!mobileOtpError}
        onChange={(value) => {
          setMobileOtp(value);
          if (mobileOtpError) setMobileOtpError("");
        }}
      />
      <FieldMessage message={mobileOtpError} />
      <AuthSubmitFooter>
        <Button
          type="submit"
          size="auth"
          disabled={!isValidOtp(mobileOtp)}
        >
          Verify mobile
        </Button>
      </AuthSubmitFooter>
    </form>
  );
}

export function AuthProfileStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    firstName,
    setFirstName,
    middleName,
    setMiddleName,
    lastName,
    setLastName,
    profileErrors,
    setProfileErrors,
    handleProfileContinue,
  } = flow;

  return (
    <form onSubmit={handleProfileContinue} className={stepPanelClass(step === "profile")}>
      <ProfileNameHeader firstName={firstName} middleName={middleName} lastName={lastName} />
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!profileErrors.firstName}>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              placeholder="e.g. Harshit"
              required
              value={firstName}
              onChange={(event) => {
                setFirstName(lettersOnly(event.target.value, "firstName"));
                if (profileErrors.firstName) {
                  setProfileErrors((prev) => ({ ...prev, firstName: undefined }));
                }
              }}
              aria-invalid={!!profileErrors.firstName}
              className={profileInputClass}
              {...inputRuleProps("firstName")}
            />
            <FieldMessage message={profileErrors.firstName} />
          </Field>
          <Field data-invalid={!!profileErrors.lastName}>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              placeholder="e.g. Kushwah"
              required
              value={lastName}
              onChange={(event) => {
                setLastName(lettersOnly(event.target.value, "lastName"));
                if (profileErrors.lastName) {
                  setProfileErrors((prev) => ({ ...prev, lastName: undefined }));
                }
              }}
              aria-invalid={!!profileErrors.lastName}
              className={profileInputClass}
              {...inputRuleProps("lastName")}
            />
            <FieldMessage message={profileErrors.lastName} />
          </Field>
        </div>
        <Field data-invalid={!!profileErrors.middleName}>
          <FieldLabel htmlFor="middleName">
            Middle name <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="middleName"
            name="middleName"
            autoComplete="additional-name"
            placeholder="Middle name if applicable"
            value={middleName}
            onChange={(event) => {
              setMiddleName(lettersOnly(event.target.value, "middleName"));
              if (profileErrors.middleName) {
                setProfileErrors((prev) => ({ ...prev, middleName: undefined }));
              }
            }}
            aria-invalid={!!profileErrors.middleName}
            className={profileInputClass}
            {...inputRuleProps("middleName")}
          />
          <FieldMessage message={profileErrors.middleName} />
        </Field>
      </FieldGroup>
      <AuthSubmitFooter>
        <Button
          type="submit"
          size="auth"
          disabled={!isProfileValid({ firstName, middleName, lastName })}
        >
          Complete &amp; go to dashboard
        </Button>
      </AuthSubmitFooter>
    </form>
  );
}
