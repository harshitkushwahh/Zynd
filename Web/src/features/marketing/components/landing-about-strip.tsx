import { landingAccentTextClass } from "@/features/marketing/lib/landing-accent";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export function LandingAboutStrip() {
  return (
    <section
      id="about"
      className="mx-auto max-w-3xl px-6 py-16 text-center sm:px-8"
    >
      <p className={cn("text-compact font-medium uppercase tracking-wider", landingAccentTextClass)}>
        {copy.marketing.aboutEyebrow()}
      </p>
      <h2 className="mt-3 text-h2 font-semibold tracking-tight text-foreground">
        {copy.marketing.aboutHeadline}
      </h2>
      <p className="mt-4 text-body leading-relaxed text-muted-foreground">
        {copy.marketing.heroLead()} {copy.marketing.heroSublead}
      </p>
    </section>
  );
}
