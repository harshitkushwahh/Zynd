"use client";

import Image from "next/image";

import { DotGrid } from "@/components/ui/dot-grid";
import { KycTestimonialCarousel } from "@/features/kyc/components/kyc-testimonial-carousel";
import { KYC_BRAND_DOT_GRID_PROPS } from "@/features/kyc/lib/kyc-brand-dot-grid";
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

export function KycVisualPanel({ activeStepId, hidePanelVisual, className }: KycVisualPanelProps) {
  if (hidePanelVisual) return null;

  const testimonials = copy.kyc.brandPanel.testimonials;
  const headline = getBrandHeadline(activeStepId);

  return (
    <aside
      className={cn(
        "relative hidden min-h-0 flex-col p-5 md:flex md:p-6",
        className,
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(160deg,var(--zynd-navy)_0%,var(--zynd-blue-dark)_58%,color-mix(in_srgb,var(--zynd-blue)_72%,var(--zynd-navy))_100%)]">
          <DotGrid {...KYC_BRAND_DOT_GRID_PROPS} className="size-full" />
          <div className="auth-brand-pattern absolute inset-0 opacity-20" />
          <div className="absolute -top-12 -right-12 size-40 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="absolute bottom-16 -left-8 size-32 rounded-full bg-primary-foreground/10 blur-2xl" />
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col p-5 md:p-6">
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

            <div className="w-full min-w-0 max-w-[280px]">
              <h2 className="text-h3 font-semibold leading-[1.15] tracking-tight text-primary-foreground">
                <span className="block">{headline.lead}</span>
                <span className="block text-primary-foreground/92">{headline.accent}</span>
              </h2>
            </div>
          </div>

          <div className="flex-1" aria-hidden />

          <div
            className={cn(
              "w-full min-w-0 rounded-[1.25rem] border border-primary-foreground/15",
              "bg-primary-foreground/10 p-4 shadow-zynd-low backdrop-blur-xl md:p-5",
            )}
          >
            <KycTestimonialCarousel className="w-full min-w-0" testimonials={testimonials} />
          </div>
        </div>
      </div>
    </aside>
  );
}
