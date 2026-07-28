import {
  Compass,
  ImageIcon,
  LayoutDashboard,
  Layers,
  Shield,
  Sparkles,
  Target,
  Users,
  Wallet,
  Headset,
} from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageTitle } from "@/components/ui/page-title";
import { APP_NAME, APP_TAGLINE } from "@/shared/config/brand";
import { ZYND_CARD_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const STEP_ICONS = [Sparkles, Wallet, Layers, Users] as const;
const PLATFORM_ICONS = [LayoutDashboard, Target, Users, Headset] as const;

function AboutMediaPlaceholder({
  label,
  hint,
  className,
  icon: Icon = ImageIcon,
  variant = "default",
}: {
  label: string;
  hint?: string;
  className?: string;
  icon?: typeof ImageIcon;
  variant?: "default" | "portrait" | "wide";
}) {
  return (
    <div
      className={cn(
        ZYND_CARD_RADIUS_CLASS,
        "relative flex flex-col items-center justify-center overflow-hidden border border-dashed border-border/80 bg-muted/30 text-muted-foreground",
        variant === "portrait" && "aspect-[4/5] min-h-[12rem]",
        variant === "wide" && "aspect-[16/10] min-h-[10rem]",
        variant === "default" && "min-h-[9rem]",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-2 px-4 py-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-[var(--radius-control)] bg-background/80 text-primary shadow-zynd-low ring-1 ring-border/60">
          <Icon className="size-5" strokeWidth={2} aria-hidden />
        </span>
        {hint ? (
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {hint}
          </span>
        ) : null}
        <span className="max-w-[12rem] text-caption leading-snug text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl space-y-1">
      <h2 className="text-h4 font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? (
        <p className="text-body leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function AboutZyndPage() {
  return (
    <div className="flex min-h-0 flex-col">
      <DashboardBreadcrumb items={[{ label: copy.about.pageTitle }]} />

      <div className="flex min-h-0 flex-col gap-10 pb-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)] lg:items-stretch">
          <header className="flex min-w-0 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {copy.about.eyebrow}
            </p>
            <PageTitle className="mt-1.5">{copy.about.heroTitle(APP_NAME)}</PageTitle>
            <p className="mt-2 max-w-xl text-body leading-relaxed text-muted-foreground">
              {copy.about.heroLead(APP_NAME)}
            </p>
            <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-[var(--radius-full)] border border-border/80 bg-muted/40 px-3 py-1.5 text-caption text-muted-foreground">
              <span className="font-medium text-foreground">{copy.about.taglineLabel}</span>
              <span aria-hidden>·</span>
              <span>{APP_TAGLINE}</span>
            </p>
          </header>
          <AboutMediaPlaceholder
            variant="wide"
            label={copy.about.heroVisualLabel}
            hint={copy.about.heroVisualHint}
            className="lg:min-h-full"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden border-border/60 shadow-none ring-foreground/10">
            <div className="grid sm:grid-cols-[minmax(0,1fr)_9.5rem]">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Compass className="size-4 text-primary" strokeWidth={2.25} />
                  {copy.about.missionTitle}
                </CardTitle>
                <CardDescription className="text-body leading-relaxed">
                  {copy.about.missionBody}
                </CardDescription>
              </CardHeader>
              <AboutMediaPlaceholder
                variant="default"
                label={copy.about.missionVisualLabel}
                hint={copy.about.heroVisualHint}
                icon={Compass}
                className="m-4 mt-0 sm:mt-4 sm:mr-4 sm:ml-0 sm:min-h-0 sm:self-stretch"
              />
            </div>
          </Card>

          <Card className="overflow-hidden border-border/60 shadow-none ring-foreground/10">
            <div className="grid sm:grid-cols-[minmax(0,1fr)_9.5rem]">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-4 text-primary" strokeWidth={2.25} />
                  {copy.about.trustTitle}
                </CardTitle>
                <CardDescription className="text-body leading-relaxed">
                  {copy.about.trustBody}
                </CardDescription>
              </CardHeader>
              <AboutMediaPlaceholder
                variant="default"
                label={copy.about.trustVisualLabel}
                hint={copy.about.heroVisualHint}
                icon={Shield}
                className="m-4 mt-0 sm:mt-4 sm:mr-4 sm:ml-0 sm:min-h-0 sm:self-stretch"
              />
            </div>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionHeading
            title={copy.about.howItWorksTitle}
            description={copy.about.howItWorksIntro}
          />

          <ol className="grid gap-3 lg:grid-cols-2">
            {copy.about.howItWorksSteps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Sparkles;
              return (
                <li key={step.title}>
                  <Card
                    size="sm"
                    className="h-full border-border/60 shadow-none ring-foreground/10"
                  >
                    <CardContent className="flex gap-4 pt-0">
                      <div className="flex flex-col items-center gap-2">
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
                            "bg-primary/10 text-primary",
                          )}
                          aria-hidden
                        >
                          <Icon className="size-4" strokeWidth={2.25} />
                        </span>
                        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5 border-l border-border/60 pl-4">
                        <p className="text-body font-semibold text-foreground">{step.title}</p>
                        <p className="text-caption leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="space-y-5">
          <SectionHeading title={copy.about.platformTitle} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {copy.about.platformPoints.map((point, index) => {
              const Icon = PLATFORM_ICONS[index] ?? LayoutDashboard;
              return (
                <li key={point}>
                  <div
                    className={cn(
                      ZYND_CARD_RADIUS_CLASS,
                      "flex h-full gap-3 border border-border/60 bg-card p-4 shadow-zynd-low",
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted text-foreground">
                      <Icon className="size-4 text-primary" strokeWidth={2.25} />
                    </span>
                    <p className="text-caption leading-relaxed text-muted-foreground">{point}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-5">
          <SectionHeading
            title={copy.about.foundersTitle}
            description={copy.about.foundersIntro}
          />
          <ul className="grid gap-4 sm:grid-cols-2">
            {copy.about.founders.map((founder) => (
              <li key={`${founder.role}-${founder.name}`}>
                <Card className="h-full overflow-hidden border-border/60 shadow-none ring-foreground/10">
                  <CardContent className="grid gap-4 pt-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start">
                    <AboutMediaPlaceholder
                      variant="portrait"
                      label={copy.about.founderPhotoPlaceholder}
                      hint={copy.about.heroVisualHint}
                      className="min-h-[9.5rem] sm:min-h-[10.5rem]"
                    />
                    <div className="min-w-0 space-y-2 pb-1">
                      <div>
                        <p className="text-body font-semibold text-foreground">{founder.name}</p>
                        <p className="text-caption font-medium text-primary">{founder.role}</p>
                      </div>
                      <p className="text-caption leading-relaxed text-muted-foreground">
                        {founder.bio}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
