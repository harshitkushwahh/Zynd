"use client";

import { KycTestimonialCarousel } from "@/features/kyc/components/kyc-testimonial-carousel";
import { APP_TAGLINE } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type DialogBrandPanelProps = {
  className?: string;
};

export function DialogBrandPanel({ className }: DialogBrandPanelProps) {
  const testimonials = copy.kyc.brandPanel.testimonials;
  const headline = copy.kyc.brandPanel.headlines.default;

  return (
    <div
      className={cn(
        "relative hidden min-h-0 flex-col overflow-hidden bg-gradient-brand md:flex",
        className,
      )}
    >
      <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 -left-10 size-36 rounded-full bg-primary-foreground/10 blur-2xl" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-8">
        <div className="max-w-[280px]">
          <h2 className="text-h2 font-semibold leading-tight text-primary-foreground">
            <span className="block">{headline.lead}</span>
            <span className="block text-primary-foreground/92">{headline.accent}</span>
          </h2>
        </div>

        <div className="flex-1" aria-hidden />

        <KycTestimonialCarousel testimonials={testimonials} />

        <p className="mt-6 text-compact font-medium text-primary-foreground/90">
          {APP_TAGLINE.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
