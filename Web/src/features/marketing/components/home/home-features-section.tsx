import Link from "next/link";
import { ArrowUpRight, Goal, Layers, LineChart, Users } from "lucide-react";

import { landingAccentIconClass, landingAccentTextClass } from "@/features/marketing/lib/landing-accent";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const ICONS = [Layers, Goal, LineChart, Users] as const;

export function HomeFeaturesSection() {
  const section = copy.marketing.homeFeatures;

  return (
    <section className="border-t border-border/60 bg-background px-6 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className={cn("text-compact font-medium uppercase tracking-wider", landingAccentTextClass)}>
            {section.eyebrow}
          </p>
          <h2 className="mt-3 text-h2 font-semibold tracking-tight text-foreground">{section.title}</h2>
          <p className="mt-4 text-body leading-relaxed text-muted-foreground">{section.description}</p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {section.items.map((item, index) => {
            const Icon = ICONS[index] ?? Layers;
            return (
              <article
                key={item.title}
                className="rounded-[var(--radius-card)] border border-border/70 bg-card p-5 shadow-zynd-low"
              >
                <span
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-full",
                    landingAccentIconClass,
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-h4 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-compact leading-relaxed text-muted-foreground">{item.description}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-8">
          <Link
            href="/features"
            className={cn(
              "inline-flex items-center gap-1.5 text-compact font-semibold hover:underline",
              landingAccentTextClass,
            )}
          >
            Explore all features
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
