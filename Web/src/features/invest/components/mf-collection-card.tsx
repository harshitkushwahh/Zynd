"use client";

import Link from "next/link";
import { ChevronRight, ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { InvestCategory } from "@/features/invest/api/invest-api";
import { collectionHref, collectionMetaFor } from "@/features/invest/lib/mf-collection-meta";
import { MF_CARD_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function CollectionIllustrationPlaceholder({ illustrationSrc }: { illustrationSrc?: string | null }) {
  if (illustrationSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={illustrationSrc}
        alt=""
        className="size-[4.5rem] object-contain object-right-top"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-[4.5rem] flex-col items-center justify-center gap-1 rounded-[var(--radius-control)]",
        "border border-dashed border-white/30 bg-black/10 dark:border-white/20 dark:bg-black/25",
      )}
    >
      <ImageIcon className="size-4 text-white/45" strokeWidth={1.75} />
      <span className="text-[0.625rem] font-medium uppercase tracking-wide text-white/35">
        Illustration
      </span>
    </div>
  );
}

type MfCollectionCardProps = {
  collection: InvestCategory;
};

export function MfCollectionCard({ collection }: MfCollectionCardProps) {
  const meta = collectionMetaFor(collection.slug);
  const { theme } = meta;
  const fundCountLabel = copy.mutualFunds.collectionFundCount.replace(
    "{count}",
    String(collection.fund_count),
  );

  return (
    <Link
      href={collectionHref(collection.slug)}
      className="group relative block h-[8.75rem] w-full min-w-0"
    >
      <div
        className={cn(
          MF_CARD_RADIUS_CLASS,
          "relative h-full overflow-hidden border shadow-sm transition-all duration-200",
          "group-hover:-translate-y-0.5 group-hover:border-white/25 group-hover:shadow-md",
          theme.cardClass,
          theme.borderClass,
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/35 via-transparent to-transparent opacity-70 dark:from-white/10"
        />

        <div className="pointer-events-none absolute -right-1 -top-1 opacity-95 transition-transform duration-200 group-hover:scale-105">
          <CollectionIllustrationPlaceholder illustrationSrc={theme.illustrationSrc} />
        </div>

        <div className={cn("absolute inset-x-0 bottom-0 p-3 pt-12", theme.footerClass)}>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "line-clamp-2 text-compact font-bold leading-snug tracking-tight drop-shadow-sm sm:text-body",
                  theme.labelClass,
                )}
              >
                {collection.name}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "mt-2 h-auto border-white/25 bg-white/15 px-2 py-0.5 text-[0.6875rem] font-semibold backdrop-blur-sm",
                  theme.labelClass,
                )}
              >
                {fundCountLabel}
              </Badge>
            </div>

            <span
              aria-hidden="true"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 backdrop-blur-sm",
                "transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-white/25",
                theme.labelClass,
              )}
            >
              <ChevronRight className="size-4" strokeWidth={2.25} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
