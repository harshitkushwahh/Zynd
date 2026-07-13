"use client";

import Link from "next/link";

import type { InvestCategory } from "@/features/invest/api/invest-api";
import {
  collectionHref,
  collectionMetaFor,
  sortCollections,
} from "@/features/invest/lib/mf-collection-meta";
import { MF_CARD_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
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
      <h2 className="text-h3 font-semibold text-foreground">{copy.mutualFunds.collectionsTitle}</h2>

      <div className="flex min-w-0 gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((collection) => {
          const meta = collectionMetaFor(collection.slug);
          const Icon = meta.icon;

          return (
            <Link
              key={collection.id}
              href={collectionHref(collection.slug)}
              className="group flex w-[5.5rem] shrink-0 flex-col items-center gap-2.5"
            >
              <div
                className={cn(
                  MF_CARD_RADIUS_CLASS,
                  "flex aspect-square w-full items-center justify-center border border-border bg-card transition-colors group-hover:border-primary/40 group-hover:bg-card/90",
                )}
              >
                <Icon className={cn("size-6", meta.accentClass)} aria-hidden="true" />
              </div>
              <span className="line-clamp-2 w-full text-center text-caption font-medium leading-snug text-foreground">
                {collection.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
