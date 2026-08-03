"use client";

import Link from "next/link";

import { useFundEligibilityStatus } from "@/features/account/mfa/hooks/use-fund-eligibility-status";
import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FundEligibilityBannerProps = {
  className?: string;
};

function resolveBannerCopy(reasons: string[]) {
  if (reasons.includes("email_verification_required")) {
    return {
      title: copy.mfa.fundEligibilityEmailTitle,
      description: copy.mfa.fundEligibilityEmailDescription,
    };
  }

  if (reasons.includes("phone_verification_required")) {
    return {
      title: copy.mfa.fundEligibilityPhoneTitle,
      description: copy.mfa.fundEligibilityPhoneDescription,
    };
  }

  return {
    title: copy.mfa.fundEligibilityTitle,
    description: copy.mfa.fundEligibilityDescription,
  };
}

export function FundEligibilityBanner({ className }: FundEligibilityBannerProps) {
  const { data: status } = useFundEligibilityStatus();

  if (!status || status.eligible) {
    return null;
  }

  const contactReasons = status.reasons.filter((reason) =>
    ["email_verification_required", "phone_verification_required"].includes(reason),
  );
  if (contactReasons.length === 0) {
    return null;
  }

  const { title, description } = resolveBannerCopy(contactReasons);

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 shadow-zynd-low sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <p className="text-compact font-medium text-foreground">{title}</p>
        <p className="text-caption text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href="/dashboard/settings">{copy.kyc.entryGate.openSettings}</Link>
      </Button>
    </div>
  );
}
