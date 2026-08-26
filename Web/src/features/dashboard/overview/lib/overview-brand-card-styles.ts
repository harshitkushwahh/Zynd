export type OverviewBrandCardTone = "emerald" | "navy" | "contrast";

export const OVERVIEW_BRAND_CARD_STYLES: Record<
  OverviewBrandCardTone,
  { card: string; title: string; muted: string; label: string; avatar: string; negative: string }
> = {
  emerald: {
    card: "bg-[var(--zynd-emerald-dark)]",
    title: "text-[var(--zynd-white)]",
    muted: "text-[var(--zynd-white)]/70",
    label: "text-[var(--zynd-white)]/55",
    avatar: "border-[var(--zynd-white)]/20 bg-[var(--zynd-white)]/10",
    negative: "text-red-100",
  },
  navy: {
    card: "bg-[var(--zynd-navy)]",
    title: "text-[var(--zynd-white)]",
    muted: "text-[var(--zynd-white)]/70",
    label: "text-[var(--zynd-white)]/55",
    avatar: "border-[var(--zynd-white)]/20 bg-[var(--zynd-white)]/10",
    negative: "text-red-200",
  },
  contrast: {
    card: "bg-[var(--zynd-neutral-900)] dark:bg-[var(--zynd-white)]",
    title: "text-[var(--zynd-white)] dark:text-[var(--zynd-neutral-900)]",
    muted: "text-[var(--zynd-white)]/70 dark:text-[var(--zynd-neutral-600)]",
    label: "text-[var(--zynd-white)]/55 dark:text-[var(--zynd-neutral-500)]",
    avatar:
      "border-[var(--zynd-white)]/20 bg-[var(--zynd-white)]/10 dark:border-[var(--zynd-neutral-900)]/12 dark:bg-[var(--zynd-neutral-900)]/8",
    negative: "text-red-200 dark:text-[var(--destructive)]",
  },
};

export function resolveOverviewBrandCardTone(index: number): OverviewBrandCardTone {
  const tones: OverviewBrandCardTone[] = ["emerald", "navy", "contrast"];
  return tones[index % tones.length];
}

export function resolveRiskTierBrandTone(tier: string): OverviewBrandCardTone {
  const normalized = tier.toLowerCase();

  if (normalized === "secure" || normalized === "conservative") {
    return "emerald";
  }

  if (normalized === "moderate") {
    return "navy";
  }

  return "contrast";
}
