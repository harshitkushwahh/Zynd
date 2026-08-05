"use client";

import Image from "next/image";
import { ClipboardCheck, FileCheck2, RefreshCw, type LucideIcon } from "lucide-react";

import {
  RISK_PROFILE_HERO_GRADIENT_CLASS,
  RISK_PROFILE_HERO_RADIUS_CLASS,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const BENEFIT_ICONS: LucideIcon[] = [FileCheck2, ClipboardCheck, RefreshCw];

type RiskAssessmentWhyCardProps = {
  className?: string;
};

export function RiskAssessmentWhyCard({ className }: RiskAssessmentWhyCardProps) {
  const benefits = copy.riskProfile.assessmentWhyBenefits;

  return (
    <aside
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden border border-primary-foreground/10 text-primary-foreground shadow-zynd-mid",
        RISK_PROFILE_HERO_RADIUS_CLASS,
        RISK_PROFILE_HERO_GRADIENT_CLASS,
        className,
      )}
    >
      <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-15" aria-hidden />
      <div className="relative z-10 flex flex-1 flex-col p-4">
        <h2 className="text-body font-semibold tracking-tight">{copy.riskProfile.assessmentWhyTitle}</h2>

        <div className="relative mx-auto my-4 h-28 w-full max-w-[11rem] shrink-0">
          <Image
            src="/risk-a.png"
            alt=""
            fill
            sizes="176px"
            className="object-contain object-center mix-blend-screen drop-shadow-lg"
          />
        </div>

        <p className="shrink-0 text-center text-caption leading-relaxed text-primary-foreground/85">
          {copy.riskProfile.assessmentWhyDescription}
        </p>

        <ul className="mt-auto space-y-3 pt-5">
          {benefits.map((benefit, index) => {
            const Icon = BENEFIT_ICONS[index] ?? FileCheck2;

            return (
              <li key={benefit.title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-primary-foreground/15 bg-primary-foreground/10">
                  <Icon className="size-4 text-primary-foreground/90" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-compact font-semibold leading-snug">{benefit.title}</p>
                  <p className="mt-0.5 text-caption leading-relaxed text-primary-foreground/75">
                    {benefit.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
