"use client";

import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { HomeHeroCtaButton } from "@/features/marketing/components/home/home-hero-cta-button";
import { HomeHeroVisual } from "@/features/marketing/components/home/home-hero-visual";
import { useTheme } from "@/contexts/theme-context";
import { copy } from "@/shared/config/copy";

export function HomeHeroSection() {
  const { homeHero } = copy.marketing;
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#94a3b8" : "#6B7280";

  return (
    <section className="landing-hero-wrap">
      <div className="landing-hero-flicker" aria-hidden>
        <FlickeringGrid
          className="h-full min-h-full w-full"
          squareSize={4}
          gridGap={6}
          color={gridColor}
          maxOpacity={0.45}
          flickerChance={0.1}
        />
      </div>
      <div className="landing-hero-inner mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="landing-hero-grid grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,1.05fr)] lg:gap-8 xl:gap-12">
          <div className="landing-hero-copy max-w-xl">
            <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.06] tracking-tight text-foreground dark:text-white">
              {homeHero.headline}
            </h1>
            <p className="mt-5 text-body leading-relaxed text-muted-foreground dark:text-white/65">
              {homeHero.description}
            </p>
            <div className="mt-8">
              <HomeHeroCtaButton />
            </div>

            <div className="mt-10 flex flex-col gap-6 border-t border-border/50 pt-8 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <p className="text-h3 font-bold tabular-nums text-foreground dark:text-white">
                  {homeHero.socialProof.metric}
                </p>
                <div className="flex -space-x-2">
                  {homeHero.socialProof.avatars.map((initials, index) => (
                    <span
                      key={initials}
                      className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-gradient-growth text-caption font-semibold text-primary-foreground dark:border-[var(--zynd-dark-bg)]"
                      style={{ zIndex: homeHero.socialProof.avatars.length - index }}
                    >
                      {initials}
                    </span>
                  ))}
                </div>
              </div>
              <p className="max-w-xs text-compact leading-relaxed text-muted-foreground dark:text-white/55">
                {homeHero.socialProof.caption}
              </p>
            </div>
          </div>

          <div className="landing-hero-visual-col flex justify-center overflow-visible lg:justify-end">
            <HomeHeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
