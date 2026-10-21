import { landingAccentTextClass } from "@/features/marketing/lib/landing-accent";
import { cn } from "@/lib/utils";

type MarketingPageIntroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  centered?: boolean;
  wide?: boolean;
};

export function MarketingPageIntro({
  eyebrow,
  title,
  description,
  className,
  centered = false,
  wide = false,
}: MarketingPageIntroProps) {
  return (
    <header
      className={cn(
        "mx-auto w-full px-6 pb-10 pt-6 sm:px-8 sm:pt-10",
        wide ? "max-w-6xl" : "max-w-3xl",
        centered && "text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className={cn("text-compact font-medium tracking-wide", landingAccentTextClass)}>
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-h1 font-bold tracking-tight text-foreground sm:text-display sm:leading-tight">
        {title}
      </h1>
      {description ? (
        <p className="mt-4 text-body leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}
