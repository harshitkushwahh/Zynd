"use client";

import Image from "next/image";
import { useMemo } from "react";

import { KycTestimonialCarousel } from "@/features/kyc/components/kyc-testimonial-carousel";
import { getKycStepPanelVisual } from "@/features/kyc/components/kyc-step-visual";
import type { KycJourneyStepId } from "@/features/kyc/lib/kyc-journey";
import { APP_NAME } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycVisualPanelProps = {
  activeStepId?: KycJourneyStepId;
  hidePanelVisual?: boolean;
  className?: string;
};

function getBrandHeadline(activeStepId?: KycJourneyStepId) {
  const headlines = copy.kyc.brandPanel.headlines;
  if (activeStepId === "pan-card") return headlines.pan;
  if (activeStepId === "review") return headlines.review;
  return headlines.default;
}

export function KycVisualPanel({ activeStepId, hidePanelVisual = false, className }: KycVisualPanelProps) {
  const testimonials = copy.kyc.brandPanel.testimonials;
  const panelVisual = useMemo(() => {
    if (hidePanelVisual) return null;
    return getKycStepPanelVisual(activeStepId);
  }, [activeStepId, hidePanelVisual]);
  const headline = useMemo(() => getBrandHeadline(activeStepId), [activeStepId]);

  return (
    <aside
      className={cn(
        "relative hidden min-h-0 flex-col bg-card p-5 pr-3 md:flex",
        className,
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-gradient-brand">
        <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-16 -left-8 size-32 rounded-full bg-primary-foreground/10 blur-2xl" />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col p-6">
          <div className="space-y-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
              <Image
                src="/logo.png"
                alt={APP_NAME}
                width={36}
                height={36}
                className="size-9 object-contain"
                priority
              />
            </div>

            <div className="max-w-[280px]">
              <h2 className="text-h3 font-semibold leading-[1.15] tracking-tight text-primary-foreground">
                <span className="block">{headline.lead}</span>
                <span className="block text-primary-foreground/92">{headline.accent}</span>
              </h2>
            </div>
          </div>

          {panelVisual ? (
            <div className="flex flex-1 items-center justify-center py-4">{panelVisual}</div>
          ) : (
            <div className="flex-1" aria-hidden />
          )}

          <KycTestimonialCarousel testimonials={testimonials} />
        </div>
      </div>
    </aside>
  );
}
