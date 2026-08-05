"use client";

import type { ReactNode } from "react";

import type { KycStepFormMeta } from "@/features/kyc/lib/kyc-step-form-meta";
import { cn } from "@/lib/utils";

type KycFormHeaderProps = {
  meta: KycStepFormMeta;
  badge?: ReactNode;
  className?: string;
};

export function KycFormHeader({ meta, badge, className }: KycFormHeaderProps) {
  return (
    <div className={cn("mb-6 text-left", className)}>
      <h2 className="text-h2 font-semibold tracking-tight text-foreground">{meta.title}</h2>
      <p className="mt-1.5 max-w-md text-compact leading-relaxed text-muted-foreground">
        {meta.description}
      </p>
      {badge ? <div className="mt-3">{badge}</div> : null}
    </div>
  );
}
