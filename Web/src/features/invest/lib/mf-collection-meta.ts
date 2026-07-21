import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Coins,
  Layers3,
  Repeat,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import type { InvestCategory } from "@/features/invest/api/invest-api";
import { copy } from "@/shared/config/copy";

export type MfCollectionTheme = {
  cardClass: string;
  labelClass: string;
  borderClass: string;
  footerClass: string;
  iconBadgeClass: string;
  glowClass: string;
  /** Optional illustration asset — when unset, a placeholder is shown. */
  illustrationSrc?: string | null;
  /** Optional scale utility for the illustration image. */
  illustrationScaleClass?: string;
  /** Optional positioning overrides for the illustration slot. */
  illustrationSlotClass?: string;
};

export type MfCollectionMeta = {
  icon: LucideIcon;
  accentClass: string;
  description: string;
  theme: MfCollectionTheme;
};

const COLLECTION_META: Record<string, MfCollectionMeta> = {
  "high-return": {
    icon: TrendingUp,
    accentClass: "text-success",
    description: copy.mutualFunds.collectionDescHighReturn,
    theme: {
      cardClass:
        "bg-gradient-to-br from-emerald-50 via-green-100 to-emerald-200 dark:from-emerald-950 dark:via-emerald-900/70 dark:to-emerald-800/40",
      labelClass: "text-emerald-950 dark:text-emerald-50",
      borderClass: "border-emerald-200/80 dark:border-emerald-700/50",
      footerClass: "bg-gradient-to-t from-emerald-950/45 via-emerald-900/15 to-transparent",
      iconBadgeClass: "border-emerald-100/40 bg-emerald-950/15 text-emerald-950 dark:border-emerald-200/25 dark:bg-white/10 dark:text-emerald-50",
      glowClass: "bg-emerald-300/35 dark:bg-emerald-400/20",
    },
  },
  "best-sip": {
    icon: Repeat,
    accentClass: "text-primary",
    description: copy.mutualFunds.collectionDescBestSip,
    theme: {
      cardClass:
        "bg-gradient-to-br from-blue-50 via-sky-100 to-blue-200 dark:from-blue-950 dark:via-blue-900/70 dark:to-blue-800/40",
      labelClass: "text-blue-950 dark:text-blue-50",
      borderClass: "border-blue-200/80 dark:border-blue-700/50",
      footerClass: "bg-gradient-to-t from-blue-950/45 via-blue-900/15 to-transparent",
      iconBadgeClass: "border-blue-100/40 bg-blue-950/15 text-blue-950 dark:border-blue-200/25 dark:bg-white/10 dark:text-blue-50",
      glowClass: "bg-sky-300/35 dark:bg-sky-400/20",
    },
  },
  "gold-silver": {
    icon: Coins,
    accentClass: "text-warning",
    description: copy.mutualFunds.collectionDescGoldSilver,
    theme: {
      cardClass:
        "bg-[linear-gradient(145deg,#fff7d6_0%,#f5c842_38%,#d4a017_72%,#9a7209_100%)] dark:bg-[linear-gradient(145deg,#3d2e08_0%,#7a5c10_35%,#c9a227_68%,#f0d875_100%)]",
      labelClass: "text-amber-50",
      borderClass: "border-amber-300/70 dark:border-amber-500/40",
      footerClass: "bg-gradient-to-t from-amber-950/80 via-amber-900/35 to-transparent",
      iconBadgeClass: "border-amber-100/35 bg-amber-950/20 text-amber-50",
      glowClass: "bg-amber-200/45 dark:bg-amber-300/25",
      illustrationSrc: "/gold.png",
    },
  },
  "large-cap": {
    icon: Layers3,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescLargeCap,
    theme: {
      cardClass:
        "bg-[linear-gradient(145deg,#eef3f8_0%,#c2d0df_38%,#7691ab_72%,#425f79_100%)] dark:bg-[linear-gradient(145deg,#1a2430_0%,#2b3d52_38%,#456078_72%,#8ea8c0_100%)]",
      labelClass: "text-slate-50",
      borderClass: "border-slate-300/60 dark:border-slate-500/35",
      footerClass: "bg-gradient-to-t from-slate-950/72 via-slate-900/28 to-transparent",
      iconBadgeClass: "border-white/25 bg-white/12 text-slate-50",
      glowClass: "bg-slate-200/30 dark:bg-slate-300/15",
      illustrationSrc: "/large.png",
      illustrationScaleClass: "scale-[1.12] origin-bottom-right",
      illustrationSlotClass: "top-5 right-3",
    },
  },
  "mid-cap": {
    icon: BarChart3,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescMidCap,
    theme: {
      cardClass:
        "bg-[linear-gradient(145deg,#edf2f4_0%,#c0cdd2_38%,#728a92_72%,#456068_100%)] dark:bg-[linear-gradient(145deg,#192226_0%,#293a40_38%,#456068_72%,#89a3aa_100%)]",
      labelClass: "text-slate-50",
      borderClass: "border-slate-300/60 dark:border-slate-500/35",
      footerClass: "bg-gradient-to-t from-slate-950/72 via-slate-900/28 to-transparent",
      iconBadgeClass: "border-white/25 bg-white/12 text-slate-50",
      glowClass: "bg-slate-200/30 dark:bg-slate-300/15",
      illustrationSrc: "/mid.png",
      illustrationScaleClass: "scale-[1.12] origin-bottom-right",
      illustrationSlotClass: "top-5 right-3",
    },
  },
  "small-cap": {
    icon: Sparkles,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescSmallCap,
    theme: {
      cardClass:
        "bg-[linear-gradient(145deg,#f0f1f6_0%,#c5c9d8_38%,#80889f_72%,#4f566c_100%)] dark:bg-[linear-gradient(145deg,#1b1e28_0%,#2d3344_38%,#4f566c_72%,#939ab0_100%)]",
      labelClass: "text-slate-50",
      borderClass: "border-slate-300/60 dark:border-slate-500/35",
      footerClass: "bg-gradient-to-t from-slate-950/72 via-slate-900/28 to-transparent",
      iconBadgeClass: "border-white/25 bg-white/12 text-slate-50",
      glowClass: "bg-slate-200/30 dark:bg-slate-300/15",
      illustrationSrc: "/small.png",
      illustrationSlotClass: "top-5 right-3",
    },
  },
};

export function collectionMetaFor(slug: string): MfCollectionMeta {
  return (
    COLLECTION_META[slug] ?? {
      icon: Layers3,
      accentClass: "text-primary",
      description: copy.mutualFunds.collectionDescDefault,
      theme: {
        cardClass:
          "bg-gradient-to-br from-muted/40 via-card to-muted/60 dark:from-muted/20 dark:via-card dark:to-muted/30",
        labelClass: "text-foreground",
        borderClass: "border-border/70",
        footerClass: "bg-gradient-to-t from-black/25 via-black/10 to-transparent dark:from-black/45 dark:via-black/20",
        iconBadgeClass: "border-border/60 bg-background/70 text-foreground",
        glowClass: "bg-primary/10",
      },
    }
  );
}

export function collectionHref(slug: string) {
  return `/dashboard/mutual-funds/collections/${slug}`;
}

const HIDDEN_COLLECTION_SLUGS = new Set(["high-return", "best-sip"]);

export function sortCollections(collections: InvestCategory[]) {
  return collections.filter((collection) => !HIDDEN_COLLECTION_SLUGS.has(collection.slug));
}
