import { Droplets, Landmark, TrendingUp, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type MfFundCategoryKind = "equity" | "debt" | "liquid";

type MfFundCategoryMeta = {
  label: string;
  icon: LucideIcon;
};

const MF_FUND_CATEGORY_META: Record<MfFundCategoryKind, MfFundCategoryMeta> = {
  equity: {
    label: "Equity",
    icon: TrendingUp,
  },
  debt: {
    label: "Debt",
    icon: Landmark,
  },
  liquid: {
    label: "Liquid",
    icon: Droplets,
  },
};

export function resolveMfFundCategoryKind(input: string | null | undefined): MfFundCategoryKind | null {
  if (!input) return null;

  const normalized = input.toLowerCase();
  if (normalized.includes("liquid")) return "liquid";
  if (normalized.includes("debt")) return "debt";
  if (normalized.includes("equity")) return "equity";

  return null;
}

export function resolveMfFundCategoryFromSlug(slug: string): MfFundCategoryKind | null {
  if (slug === "equity-funds") return "equity";
  if (slug === "debt-funds") return "debt";
  if (slug === "liquid-funds") return "liquid";

  return resolveMfFundCategoryKind(slug);
}

export function mfFundCategoryMetaFor(kind: MfFundCategoryKind) {
  return MF_FUND_CATEGORY_META[kind];
}

type MfFundCategoryBadgeProps = {
  kind: MfFundCategoryKind;
  label?: string;
  showLabel?: boolean;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
};

export function MfFundCategoryBadge({
  kind,
  label,
  showLabel = false,
  className,
  iconClassName,
  labelClassName,
}: MfFundCategoryBadgeProps) {
  const meta = mfFundCategoryMetaFor(kind);
  const Icon = meta.icon;
  const accessibleLabel = label ?? meta.label;

  return (
    <span
      role="img"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        "inline-flex shrink-0 items-center gap-1",
        showLabel &&
          "rounded-[var(--radius-control)] border border-border/70 px-1.5 py-0.5",
        className,
      )}
    >
      <Icon
        className={cn("size-3 shrink-0 text-muted-foreground", iconClassName)}
        strokeWidth={2}
        aria-hidden
      />
      {showLabel ? (
        <span
          className={cn(
            "truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
            labelClassName,
          )}
        >
          {meta.label}
        </span>
      ) : null}
    </span>
  );
}