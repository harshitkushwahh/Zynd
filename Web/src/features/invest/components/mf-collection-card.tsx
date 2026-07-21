"use client";

import Link from "next/link";
import { ChevronRight, ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { InvestCategory } from "@/features/invest/api/invest-api";
import { collectionHref, collectionMetaFor } from "@/features/invest/lib/mf-collection-meta";
import { MF_CARD_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const ILLUSTRATION_SLOT_CLASS =
  "pointer-events-none absolute right-3 top-3 bottom-[3.25rem] w-[min(46%,9rem)]";

function CollectionIllustration({
  illustrationSrc,
  scaleClass,
}: {
  illustrationSrc?: string | null;
  scaleClass?: string;
}) {
  if (illustrationSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={illustrationSrc}
        alt=""
        className={cn(
          "h-full w-full object-contain object-right-bottom",
          scaleClass,
        )}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-full w-full flex-col items-center justify-end rounded-[var(--radius-control)] pb-1",
        "border border-dashed border-white/30 bg-black/10 dark:border-white/20 dark:bg-black/25",
      )}
    >
      <ImageIcon className="size-4 text-white/45" strokeWidth={1.75} />
      <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-wide text-white/35">
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

        <div
          className={cn(
            ILLUSTRATION_SLOT_CLASS,
            theme.illustrationSlotClass,
            "z-[1] transition-transform duration-200 group-hover:scale-[1.03]",
          )}
        >
          <CollectionIllustration
            illustrationSrc={theme.illustrationSrc}
            scaleClass={theme.illustrationScaleClass}
          />
        </div>

        <div className={cn("absolute inset-x-0 bottom-0 z-[2] p-3 pr-14", theme.footerClass)}>
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
            "absolute bottom-3 right-3 z-[3] flex size-7 items-center justify-center rounded-full",
            "border border-white/30 bg-white/20 shadow-sm backdrop-blur-md",
            "transition-all duration-200 group-hover:translate-x-0.5 group-hover:border-white/40 group-hover:bg-white/30",
            theme.labelClass,
          )}
        >
          <ChevronRight className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
