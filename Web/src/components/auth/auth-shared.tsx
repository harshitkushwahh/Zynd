"use client";

import Image from "next/image";
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

import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PASSWORD_CRITERIA } from "@/lib/password-criteria";
import { DEFAULT_COUNTRY } from "@/lib/input-rules";
import { IndiaFlagIcon } from "@/components/auth/india-flag-icon";
import { APP_NAME } from "@/shared/config/brand";
import { cn } from "@/lib/utils";

const SIGNUP_STEPS = [
  { id: "email-otp" },
  { id: "password" },
  { id: "mobile" },
  { id: "mobile-otp" },
  { id: "profile" },
] as const;

export type SignupStepId = (typeof SIGNUP_STEPS)[number]["id"];

export function AuthProgress({
  currentStep,
  compact = false,
}: {
  currentStep: SignupStepId | null;
  compact?: boolean;
}) {
  if (!currentStep) return null;

  const currentIndex = SIGNUP_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className={compact ? "mb-3" : "mb-6"}>
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
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mb-0" : "mb-4"}>
      <span
        className={cn(
          "relative inline-flex overflow-hidden rounded-full bg-white ring-2 ring-neutral-300",
          compact ? "mb-2 size-10" : "mb-3 size-12",
        )}
      >
        <Image
          src="/logo.png"
          alt={APP_NAME}
          width={64}
          height={64}
          className="absolute left-[-6px] top-[-4px] size-[60px] max-w-none object-fill"
          priority
        />
      </span>
      <h2 className="text-[1.125rem] font-semibold leading-snug tracking-tight text-foreground sm:text-[1.1875rem]">
        {title}
      </h2>
      <p
        className={cn(
          "max-w-full text-caption leading-snug text-muted-foreground sm:text-compact",
          compact ? "mt-1" : "mt-2",
        )}
      >
        {description}
      </p>
    </div>
  );
}

export function EmailChip({
  email,
  onEdit,
  verified = false,
}: {
  email: string;
  onEdit?: () => void;
  /** Hide edit once email OTP is verified (password, mobile, and later steps). */
  verified?: boolean;
}) {
  const showEdit = !verified && onEdit;

  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-muted/40 px-3 py-2 shadow-zynd-low">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
        <Mail className="size-3.5" />
      </div>
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">{email}</span>
      {showEdit ? (
        <button
          type="button"
          aria-label="Edit email"
          onClick={onEdit}
          className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

export function MobileChip({
  mobile,
  onEdit,
  className,
}: {
  mobile: string;
  onEdit: () => void;
  className?: string;
}) {
  const formatted = mobile.replace(/(\d{5})(\d{5})/, "$1 $2");
  return (
    <div
      className={cn(
        "mb-3 flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-muted/40 px-3 py-2 shadow-zynd-low",
        className,
      )}
    >
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
  const readyLabel = resend?.readyLabel ?? "Resend code";
  const resendLabel = canResend ? readyLabel : `${secondsLeft} seconds until resend`;

  return (
    <Alert
      variant="info"
      className="mb-3 mt-0 gap-1.5 rounded-[var(--radius-card)] px-3 py-2 shadow-zynd-low has-[>svg]:gap-x-2"
    >
      <Info className="size-4" />
      <AlertDescription className="col-start-2 text-[0.6875rem] leading-snug text-current/90 sm:text-caption [&_p:not(:last-child)]:mb-0">
        <p>{message}</p>
      </AlertDescription>
      {resend ? (
        <AlertAction className="top-1/2 -translate-y-1/2">
          <Button
            type="button"
            variant="outline"
            size={canResend ? "icon-xs" : "xs"}
            className={
              canResend
                ? "border-info/30 bg-background/80 text-info hover:border-info/40 hover:bg-info/10 hover:text-info"
                : "min-w-[2.75rem] border-info/30 bg-background/80 px-2.5 text-info tabular-nums disabled:bg-background/60"
            }
            disabled={!canResend || resend.disabled}
            onClick={resend.onResend}
            aria-label={resendLabel}
            title={resendLabel}
          >
            {canResend ? (
              <RefreshCw className="size-3.5" aria-hidden />
            ) : (
              <span className="text-caption font-medium">{secondsLeft}s</span>
            )}
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  );
}

export function OtpInput({
  value,
  onChange,
  error,
  id,
  variant = "default",
  className,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  id?: string;
  variant?: "default" | "square";
  className?: string;
  disabled?: boolean;
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

  const isSquare = variant === "square";

  return (
    <div className={cn(isSquare ? "w-full" : "space-y-2", className)}>
      <div
        className={cn(
          "flex w-full",
          isSquare ? "justify-center gap-2 sm:gap-2.5" : "justify-between gap-2",
        )}
        onPaste={handlePaste}
      >
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
            disabled={disabled}
            aria-invalid={error}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            className={cn(
              "text-center text-body font-semibold text-foreground shadow-zynd-low outline-none transition-all focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30",
              isSquare
                ? "aspect-square min-w-0 flex-1 rounded-[var(--radius-control)] border border-border/80 bg-muted/20"
                : "h-11 w-full rounded-[var(--radius-control)] border border-input bg-muted/20 font-medium",
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
    <div className={cn("space-y-3 pt-4", className)}>
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
  return "flex w-full flex-col animate-in fade-in duration-300";
}

export const profileInputClass =
  "h-11 rounded-[var(--radius-control)] border border-input bg-background px-3 shadow-zynd-low transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20";

export const underlineInputClass = "auth-input-underline";

export const otpInputClass =
  "auth-input-underline text-center tracking-[0.35em] text-body font-medium";
