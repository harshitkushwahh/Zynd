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
  /** Optional illustration asset — when unset, a placeholder is shown. */
  illustrationSrc?: string | null;
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
    },
  },
  "large-cap": {
    icon: Layers3,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescLargeCap,
    theme: {
      cardClass:
        "bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950/80",
      labelClass: "text-slate-50",
      borderClass: "border-slate-200/90 dark:border-slate-600/50",
      footerClass: "bg-gradient-to-t from-slate-950/70 via-slate-900/30 to-transparent",
    },
  },
  "mid-cap": {
    icon: BarChart3,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescMidCap,
    theme: {
      cardClass:
        "bg-gradient-to-br from-teal-50 via-emerald-100 to-cyan-100 dark:from-teal-950 dark:via-emerald-900/70 dark:to-cyan-950/60",
      labelClass: "text-teal-50",
      borderClass: "border-teal-200/80 dark:border-teal-700/50",
      footerClass: "bg-gradient-to-t from-teal-950/70 via-teal-900/30 to-transparent",
    },
  },
  "small-cap": {
    icon: Sparkles,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescSmallCap,
    theme: {
      cardClass:
        "bg-gradient-to-br from-violet-50 via-purple-100 to-fuchsia-100 dark:from-violet-950 dark:via-purple-900/70 dark:to-fuchsia-950/50",
      labelClass: "text-violet-50",
      borderClass: "border-violet-200/80 dark:border-violet-700/50",
      footerClass: "bg-gradient-to-t from-violet-950/70 via-violet-900/30 to-transparent",
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
