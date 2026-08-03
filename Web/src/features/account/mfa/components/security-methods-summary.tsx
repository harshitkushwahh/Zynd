"use client";

import { useEffect, useState } from "react";
import { Smartphone, ShieldCheck } from "lucide-react";

import { fetchAuthSecurityPolicy } from "@/features/account/api/mfa-api";
import type { AuthSecurityPolicy } from "@/features/auth/api/types";
import { copy } from "@/shared/config/copy";

function describeLoginMethods(policy: AuthSecurityPolicy, phoneVerified: boolean) {
  const methods: string[] = [];
  if (policy.mfa_enrolled) {
    methods.push(copy.settings.securityMethodsAuthenticator);
    if (policy.step_up_sms_fallback_enabled && phoneVerified) {
      methods.push(copy.settings.securityMethodsSmsFallback);
    }
  } else if (policy.login_sms_otp_when_mfa_disabled && phoneVerified) {
    methods.push(copy.settings.securityMethodsSmsLogin);
  } else {
    methods.push(copy.settings.securityMethodsPasswordOnly);
  }
  return methods.join(" · ");
}

export function SecurityMethodsSummary({
  phoneVerified,
}: {
  phoneVerified: boolean;
}) {
  const [policy, setPolicy] = useState<AuthSecurityPolicy | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAuthSecurityPolicy()
      .then((result) => {
        if (!cancelled) setPolicy(result);
      })
      .catch(() => {
        if (!cancelled) setPolicy(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!policy) return null;

  const smsUnavailable =
    !policy.step_up_sms_fallback_enabled || !phoneVerified;

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-muted/10 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
          <ShieldCheck className="size-4" />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-compact font-semibold text-foreground">
            {copy.settings.securityMethodsTitle}
          </p>
          <p className="text-caption leading-relaxed text-muted-foreground">
            {describeLoginMethods(policy, phoneVerified)}
          </p>
          {smsUnavailable && policy.mfa_enrolled ? (
            <p className="flex items-start gap-2 text-caption leading-relaxed text-muted-foreground">
              <Smartphone className="mt-0.5 size-3.5 shrink-0" />
              {copy.settings.securityMethodsSmsUnavailable}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
