"use client";

import type { InvestCategory } from "@/features/invest/api/invest-api";
import { MfCollectionCard } from "@/features/invest/components/mf-collection-card";
import { sortCollections } from "@/features/invest/lib/mf-collection-meta";
import { MF_COLLECTIONS_GRID_CLASS } from "@/features/invest/lib/mf-ui";
import { SectionTitle } from "@/components/ui/page-title";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfCollectionCardsProps = {
  collections: InvestCategory[];
  className?: string;
};

export function MfCollectionCards({ collections, className }: MfCollectionCardsProps) {
  if (collections.length === 0) return null;

  const items = sortCollections(collections);

  return (
    <section className={cn("min-w-0 space-y-4", className)}>
      <div className="space-y-1.5">
        <SectionTitle>{copy.mutualFunds.collectionsTitle}</SectionTitle>
      </div>

      <div className={MF_COLLECTIONS_GRID_CLASS}>
        {items.map((collection) => (
          <MfCollectionCard key={collection.id} collection={collection} />
        ))}
      </div>
    </section>
  );
}
