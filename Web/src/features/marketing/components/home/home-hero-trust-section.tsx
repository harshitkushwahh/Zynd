import { copy } from "@/shared/config/copy";

export function HomeHeroTrustSection() {
  const { homeHero } = copy.marketing;

  return (
    <section className="landing-hero-trust bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 pb-10 pt-10 sm:px-8 sm:pb-12 sm:pt-12">
        <p className="text-center text-caption font-medium text-muted-foreground">
          {homeHero.partnersTitle}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-80 grayscale transition-opacity hover:opacity-100">
          {homeHero.partners.map((partner) => (
            <div key={partner.name} className="flex h-8 items-center">
              <img
                src={partner.logoSrc}
                alt={partner.name}
                width={partner.width ?? 96}
                height={28}
                className="h-7 w-auto max-h-7 object-contain dark:brightness-110"
              />
            </div>
          ))}
        </div>

        <div className="landing-hero-stats mt-10 grid sm:grid-cols-3 lg:mt-12">
          {homeHero.stats.map((stat) => (
            <div
              key={stat.label}
              className="landing-hero-stat-cell flex flex-col items-center px-4 py-6 text-center sm:py-8"
            >
              <p className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-none tracking-tight text-foreground">
                {stat.value}
              </p>
              <p className="mt-2 text-compact text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
