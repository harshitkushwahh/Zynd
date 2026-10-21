import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { landingAccentTextClass } from "@/features/marketing/lib/landing-accent";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export function HomeProductsSection() {
  const { homeProducts, productsPage } = copy.marketing;

  return (
    <section className="border-t border-border/60 bg-muted/30 px-6 py-16 dark:bg-white/[0.03] sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className={cn("text-compact font-medium uppercase tracking-wider", landingAccentTextClass)}>
            {homeProducts.eyebrow}
          </p>
          <h2 className="mt-3 text-h2 font-semibold tracking-tight text-foreground">{homeProducts.title}</h2>
          <p className="mt-4 text-body leading-relaxed text-muted-foreground">{homeProducts.description}</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {productsPage.items.map((item) => (
            <article
              key={item.title}
              className="rounded-[var(--radius-card)] border border-border/70 bg-background p-6 shadow-zynd-low"
            >
              <h3 className="text-h4 font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-compact leading-relaxed text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/products"
            className={cn(
              "inline-flex items-center gap-1.5 text-compact font-semibold hover:underline",
              landingAccentTextClass,
            )}
          >
            View products
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
