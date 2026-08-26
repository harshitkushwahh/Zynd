"use client";

import { useRef } from "react";
import {
  Check,
  Info,
  ListChecks,
  Mail,
  Pencil,
  RefreshCw,
  User,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PASSWORD_CRITERIA } from "@/lib/password-criteria";
import { DEFAULT_COUNTRY } from "@/lib/input-rules";
import { IndiaFlagIcon } from "@/components/auth/india-flag-icon";
import { APP_TAGLINE } from "@/shared/config/brand";
import { cn } from "@/lib/utils";

const SIGNUP_STEPS = [
  { id: "email-otp" },
  { id: "password" },
  { id: "mobile" },
  { id: "mobile-otp" },
  { id: "profile" },
] as const;

export type SignupStepId = (typeof SIGNUP_STEPS)[number]["id"];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-brand md:flex md:flex-col md:justify-between md:p-8">
      <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 -left-10 size-36 rounded-full bg-primary-foreground/10 blur-2xl" />

      <div className="relative z-10">
        <p className="max-w-[220px] text-h2 font-semibold leading-tight text-primary-foreground">
          Simple, secure wealth management.
        </p>
      </div>

      <div className="relative z-10">
        <p className="text-compact font-medium text-primary-foreground/90">
          {APP_TAGLINE.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

export function AuthProgress({
  currentStep,
}: {
  currentStep: SignupStepId | null;
}) {
  if (!currentStep) return null;

  const currentIndex = SIGNUP_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="mb-6">
      <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-muted/50 px-2.5 py-1 text-caption font-medium text-muted-foreground">
        Step {currentIndex + 1} of {SIGNUP_STEPS.length}
      </span>
      <div className="mt-3 flex gap-1.5">
        {SIGNUP_STEPS.map((item, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div
              key={item.id}
              className={cn(
                "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
                done && "bg-success",
                active && "bg-primary",
                !done && !active && "bg-border"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export function AuthFormHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-h3 font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1.5 text-compact leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function EmailChip({
  email,
  onEdit,
}: {
  email: string;
  onEdit: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-muted/40 px-3 py-2 shadow-zynd-low">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
        <Mail className="size-3.5" />
      </div>
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">{email}</span>
      <button
        type="button"
        aria-label="Edit email"
        onClick={onEdit}
        className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  );
}

export function MobileChip({
  mobile,
  onEdit,
}: {
  mobile: string;
  onEdit: () => void;
}) {
  const formatted = mobile.replace(/(\d{5})(\d{5})/, "$1 $2");
  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-muted/40 px-3 py-2 shadow-zynd-low">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/60">
        <IndiaFlagIcon className="size-4 border-0 shadow-none" />
      </div>
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">
        {DEFAULT_COUNTRY.dialCode} {formatted}
      </span>
      <button
        type="button"
        aria-label="Edit mobile number"
        onClick={onEdit}
        className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  );
}

function CriteriaIndicator({ met }: { met: boolean }) {
  return (
    <span
      className={cn(
        "flex size-3 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
        met
          ? "border-success bg-success text-success-foreground"
          : "border-muted-foreground/30 bg-transparent"
      )}
    >
      {met ? <Check className="size-2" strokeWidth={3} aria-hidden /> : null}
    </span>
  );
}

export function PasswordCriteriaList({ password }: { password: string }) {
  return (
    <div className="mt-3 rounded-[var(--radius-control)] border border-border/70 bg-muted/15 px-2.5 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListChecks className="size-3.5 shrink-0" aria-hidden />
        <span>Must include</span>
      </div>
      <ul className="flex flex-wrap gap-x-2 gap-y-1">
        {PASSWORD_CRITERIA.map((criterion) => {
          const met = criterion.test(password);
          return (
            <li
              key={criterion.id}
              className={cn(
                "inline-flex items-center gap-1 text-xs leading-none transition-colors duration-200",
                met ? "text-success" : "text-muted-foreground"
              )}
            >
              <CriteriaIndicator met={met} />
              <span>{criterion.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type OtpResendAction = {
  canResend: boolean;
  secondsLeft: number;
  onResend: () => void;
  disabled?: boolean;
  readyLabel?: string;
};

export function OtpInfoBanner({
  message,
  resend,
}: {
  message: string;
  resend?: OtpResendAction;
}) {
  const canResend = resend?.canResend ?? false;
  const secondsLeft = resend?.secondsLeft ?? 0;
  const resendLabel = canResend
    ? (resend?.readyLabel ?? "Resend code")
    : `Resend in ${secondsLeft}s`;

  return (
    <Alert
      variant="info"
      className="mb-3 mt-0 gap-1.5 rounded-[var(--radius-card)] px-3 py-2 shadow-zynd-low has-[>svg]:gap-x-2"
    >
      <Info className="size-4" />
      <AlertDescription className="col-start-2 text-caption leading-snug text-current/90 [&_p:not(:last-child)]:mb-0">
        <p>{message}</p>
        {resend ? (
          <div className="mt-2 flex justify-end border-t border-info/15 pt-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="min-w-[6.25rem] border-info/30 bg-background/80 text-info hover:border-info/40 hover:bg-info/10 hover:text-info disabled:bg-background/60"
              disabled={!canResend || resend.disabled}
              onClick={resend.onResend}
              aria-label={resendLabel}
              title={resendLabel}
            >
              {canResend ? (
                <>
                  <RefreshCw className="size-3" aria-hidden />
                  {resend.readyLabel ?? "Resend code"}
                </>
              ) : (
                <span className="tabular-nums">{resendLabel}</span>
              )}
            </Button>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function OtpInput({
  value,
  onChange,
  error,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  id?: string;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  const updateDigit = (index: number, digit: string) => {
    const cleaned = digit.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[index] = cleaned;
    const joined = next.join("").replace(/\s/g, "").slice(0, 6);
    onChange(joined);

    if (cleaned && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-2" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            id={index === 0 ? id : undefined}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit.trim()}
            aria-invalid={error}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            className={cn(
              "h-11 w-full rounded-[var(--radius-control)] border border-input bg-muted/20 text-center text-body font-medium text-foreground shadow-zynd-low outline-none transition-all focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30",
              error && "border-destructive focus-visible:ring-destructive/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function AuthSubmitFooter({
  children,
  hint,
  className,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-auto space-y-3 pt-4", className)}>
      {children}
      {hint ? (
        <div className="text-center text-caption leading-relaxed text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function ProfileNameHeader({
  firstName,
  middleName,
  lastName,
}: {
  firstName: string;
  middleName: string;
  lastName: string;
}) {
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();

  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
        <User className="size-5" />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-h4 font-semibold tracking-tight",
            fullName ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {fullName || "Your name"}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          Legal name as it appears on your documents
        </p>
      </div>
    </div>
  );
}

export function stepPanelClass(active: boolean) {
  if (!active) return "hidden";
  return "flex flex-1 flex-col animate-in fade-in duration-300";
}

export const profileInputClass =
  "h-11 rounded-[var(--radius-control)] border border-input bg-background px-3 shadow-zynd-low transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20";

export const underlineInputClass = "auth-input-underline";

export const otpInputClass =
  "auth-input-underline text-center tracking-[0.35em] text-body font-medium";
