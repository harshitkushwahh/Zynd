import type { LucideIcon } from "lucide-react";

import { RISK_PROFILE_HERO_RADIUS_CLASS } from "@/features/risk-profile/lib/risk-tier-ui";
import { cn } from "@/lib/utils";

type RiskProfileIllustrationSlotProps = {
  label: string;
  icon?: LucideIcon;
  className?: string;
  align?: "left" | "right" | "center";
  tone?: "default" | "hero";
};

export function RiskProfileIllustrationSlot({
  label,
  icon: Icon,
  className,
  align = "center",
  tone = "default",
}: RiskProfileIllustrationSlotProps) {
  const isHero = tone === "hero";

  return (
    <div
      aria-hidden
      className={cn(
        "relative min-h-[11rem] shrink-0 overflow-hidden sm:min-h-[12.5rem]",
        RISK_PROFILE_HERO_RADIUS_CLASS,
        isHero
          ? "border border-primary-foreground/15 bg-primary-foreground/8 backdrop-blur-sm"
          : "border border-dashed border-border/80 bg-gradient-to-br from-primary/8 via-muted/20 to-transparent",
        align === "left" && "sm:w-[42%]",
        align === "right" && "sm:w-[42%]",
        align === "center" && "w-full min-h-[10rem]",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          isHero
            ? "bg-[radial-gradient(circle_at_50%_35%,color-mix(in_srgb,var(--zynd-emerald)_24%,transparent),transparent_68%)]"
            : "bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_68%)]",
        )}
      />
      {Icon ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon
            className={cn(
              "size-16 sm:size-20",
              isHero ? "text-primary-foreground/20" : "text-muted-foreground/25",
            )}
            strokeWidth={1.25}
          />
        </div>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}
