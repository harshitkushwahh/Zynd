"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Loader2, Mail, Pencil, Phone } from "lucide-react";

import { AddInvestorOtpField } from "@/components/add-investor/add-investor-otp-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADD_INVESTOR_DEMO_OTP } from "@/lib/add-investor/add-investor-journey";
import { delay } from "@/lib/add-investor/add-investor-demo";
import { cn } from "@/lib/utils";

type AddInvestorVerifyChannelProps = {
  channel: "email" | "mobile";
  value: string;
  onValueChange: (value: string) => void;
  otp: string;
  onOtpChange: (otp: string) => void;
  inputValid: boolean;
  /** Adjusts helper copy for distributor onboarding vs investor. */
  audience?: "investor" | "distributor";
};

const CHANNEL_META: Record<
  AddInvestorVerifyChannelProps["channel"],
  { title: string; description: string; icon: LucideIcon; inputLabel: string; placeholder: string; editLabel: string }
> = {
  email: {
    title: "Email verification",
    description: "Enter the investor email and confirm with the inbox OTP.",
    icon: Mail,
    inputLabel: "Email address",
    placeholder: "investor@example.com",
    editLabel: "Edit email",
  },
  mobile: {
    title: "Mobile verification",
    description: "Indian mobile number and SMS OTP — same as the web signup flow.",
    icon: Phone,
    inputLabel: "Mobile number",
    placeholder: "10-digit number",
    editLabel: "Edit mobile number",
  },
};

const DISTRIBUTOR_CHANNEL_DESC: Partial<Record<AddInvestorVerifyChannelProps["channel"], string>> = {
  email: "Enter the distributor work email and confirm with the inbox OTP.",
  mobile: "Indian mobile number and SMS OTP for login and txn alerts.",
};

export function AddInvestorVerifyChannel({
  channel,
  value,
  onValueChange,
  otp,
  onOtpChange,
  inputValid,
  audience = "investor",
}: AddInvestorVerifyChannelProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  const description =
    audience === "distributor" && DISTRIBUTOR_CHANNEL_DESC[channel]
      ? DISTRIBUTOR_CHANNEL_DESC[channel]
      : meta.description;
  const otpComplete = otp.length === 6;
  const verified = otpSent && otp === ADD_INVESTOR_DEMO_OTP;

  const destination =
    channel === "email" ? value : value.length === 10 ? `+91 ${value}` : "+91 —";

  const handleSendOtp = async () => {
    if (!inputValid) return;
    setSending(true);
    await delay(500);
    setSending(false);
    setOtpSent(true);
    onOtpChange("");
  };

  const handleValueChange = (next: string) => {
    onValueChange(next);
    setOtpSent(false);
    onOtpChange("");
  };

  const handleEditDestination = () => {
    setOtpSent(false);
    onOtpChange("");
  };

  return (
    <div
      className={cn(
        "add-investor-verify",
        verified && "add-investor-verify--verified",
        otpSent && !verified && "add-investor-verify--pending",
      )}
    >
      <div className="add-investor-verify__head">
        <span className="add-investor-verify__icon" aria-hidden>
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="quick-txn-wizard__section-title">{meta.title}</h2>
          <p className="quick-txn-wizard__section-desc add-investor-verify__intro-desc">{description}</p>
        </div>
        {verified ? (
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : null}
      </div>

      {!otpSent ? (
        <div className="add-investor-verify__capture">
          <label className="add-investor-verify__label" htmlFor={`add-investor-${channel}-value`}>
            {meta.inputLabel}
          </label>
          <div className="add-investor-verify__row">
            {channel === "mobile" ? (
              <div className="add-investor-phone-input min-w-0 flex-1">
                <span className="add-investor-phone-input__prefix">+91</span>
                <Input
                  id={`add-investor-${channel}-value`}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder={meta.placeholder}
                  value={value}
                  onChange={(event) => handleValueChange(event.target.value)}
                  className="add-investor-phone-input__control"
                />
              </div>
            ) : (
              <Input
                id={`add-investor-${channel}-value`}
                type="email"
                autoComplete="email"
                placeholder={meta.placeholder}
                value={value}
                onChange={(event) => handleValueChange(event.target.value.trim())}
                className="min-w-0 flex-1"
              />
            )}
            <Button type="button" disabled={!inputValid || sending} onClick={handleSendOtp}>
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send code"
              )}
            </Button>
          </div>
          <p className="add-investor-verify__hint">
            We&apos;ll send a 6-digit code to verify this {channel === "email" ? "email" : "number"}.
          </p>
        </div>
      ) : (
        <div className="add-investor-verify__otp-phase">
          <div className="add-investor-verify__destination">
            <div className="add-investor-verify__destination-text">
              <p className="add-investor-verify__destination-label">Code sent to</p>
              <p className="add-investor-verify__destination-value">{destination}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0"
              aria-label={meta.editLabel}
              onClick={handleEditDestination}
            >
              <Pencil className="size-3.5" strokeWidth={2.25} aria-hidden />
            </Button>
          </div>

          <div className="add-investor-verify__otp-block">
            <p className="add-investor-verify__label">Enter 6-digit code</p>
            <AddInvestorOtpField
              id={`add-investor-${channel}-otp`}
              value={otp}
              onChange={onOtpChange}
            />
            <div className="add-investor-verify__otp-footer">
              <p className="add-investor-verify__hint">
                Demo code:{" "}
                <span className="font-mono font-medium text-foreground">{ADD_INVESTOR_DEMO_OTP}</span>
                {otpComplete && !verified ? (
                  <span className="text-destructive"> · Code doesn&apos;t match demo OTP</span>
                ) : null}
              </p>
              <Button
                type="button"
                variant="link"
                className="h-auto shrink-0 px-0 text-caption"
                disabled={!inputValid || sending}
                onClick={handleSendOtp}
              >
                {sending ? "Sending…" : "Resend code"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
