import Link from "next/link";
import { ArrowUpRight, Goal, Layers, LineChart, Sparkles, Target, Users, Wallet } from "lucide-react";

import { MarketingPageIntro } from "@/features/marketing/components/marketing-page-intro";
import { landingAccentIconClass, landingAccentTextClass } from "@/features/marketing/lib/landing-accent";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const FEATURE_ICONS = [Layers, Goal, LineChart, Users] as const;
const HIGHLIGHT_ICONS = [Wallet, Target, Sparkles] as const;

export function FeaturesPageContent() {
  const page = copy.marketing.featuresPage;
  const features = copy.marketing.homeFeatures.items;
  const highlights = copy.marketing.featureCards;

  return (
    <>
      <MarketingPageIntro eyebrow={page.eyebrow} title={page.title} description={page.description} wide />
      <section className="mx-auto w-full max-w-6xl px-6 pb-16 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((item, index) => {
            const Icon = FEATURE_ICONS[index] ?? Layers;
            return (
              <article
                key={item.title}
                className="flex gap-4 rounded-[var(--radius-card)] border border-border/70 bg-card p-5 shadow-zynd-low sm:p-6"
              >
                <span
                  className={cn(
                    "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
                    landingAccentIconClass,
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-h4 font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 text-compact leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/30 dark:bg-white/[0.03]">
        <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-8 sm:py-16">
          <p className={cn("text-compact font-medium uppercase tracking-wider", landingAccentTextClass)}>
            {page.highlightsEyebrow}
          </p>
          <h2 className="mt-3 max-w-xl text-h2 font-semibold tracking-tight text-foreground">
            {page.highlightsTitle}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {highlights.map((item, index) => {
              const Icon = HIGHLIGHT_ICONS[index] ?? Sparkles;
              return (
                <article
                  key={item.label}
                  className="rounded-[var(--radius-card)] border border-border/70 bg-background p-5 shadow-zynd-low"
                >
                  <span
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-full",
                      landingAccentIconClass,
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className={cn("mt-4 text-h4 font-semibold", landingAccentTextClass)}>{item.label}</h3>
                  <p className="mt-2 text-compact leading-relaxed text-muted-foreground">{item.value}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-8">
            <Link
              href="/products"
              className={cn(
                "inline-flex items-center gap-1.5 text-compact font-semibold hover:underline",
                landingAccentTextClass,
              )}
            >
              {page.productsCta}
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
