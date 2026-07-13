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

export type MfCollectionMeta = {
  icon: LucideIcon;
  accentClass: string;
  description: string;
};

const COLLECTION_META: Record<string, MfCollectionMeta> = {
  "high-return": {
    icon: TrendingUp,
    accentClass: "text-success",
    description: copy.mutualFunds.collectionDescHighReturn,
  },
  "best-sip": {
    icon: Repeat,
    accentClass: "text-primary",
    description: copy.mutualFunds.collectionDescBestSip,
  },
  "gold-silver": {
    icon: Coins,
    accentClass: "text-warning",
    description: copy.mutualFunds.collectionDescGoldSilver,
  },
  "large-cap": {
    icon: Layers3,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescLargeCap,
  },
  "mid-cap": {
    icon: BarChart3,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescMidCap,
  },
  "small-cap": {
    icon: Sparkles,
    accentClass: "text-foreground",
    description: copy.mutualFunds.collectionDescSmallCap,
  },
};

export function collectionMetaFor(slug: string): MfCollectionMeta {
  return (
    COLLECTION_META[slug] ?? {
      icon: Layers3,
      accentClass: "text-primary",
      description: copy.mutualFunds.collectionDescDefault,
    }
  );
}

export function collectionHref(slug: string) {
  return `/dashboard/mutual-funds/collections/${slug}`;
}

export function sortCollections(collections: InvestCategory[]) {
  return collections;
}
