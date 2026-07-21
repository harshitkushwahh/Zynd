"use client";

import Link from "next/link";
import { ChevronRight, ImageIcon } from "lucide-react";

import type { InvestCategory } from "@/features/invest/api/invest-api";
import { collectionHref, collectionMetaFor } from "@/features/invest/lib/mf-collection-meta";
import { MF_CARD_RADIUS_CLASS, MF_COLLECTION_CARD_MIN_HEIGHT_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const ILLUSTRATION_SLOT_CLASS =
  "pointer-events-none absolute right-0 top-1 bottom-[3.5rem] w-[min(52%,10rem)] sm:bottom-[3.75rem]";

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
          "h-full w-full object-contain object-right-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.22)]",
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
  const { theme, icon: Icon, description } = meta;
  const fundCountLabel = copy.mutualFunds.collectionFundCount.replace(
    "{count}",
    String(collection.fund_count),
  );

  return (
    <Link
      href={collectionHref(collection.slug)}
      className={cn(
        "group relative block w-full min-w-0",
        MF_COLLECTION_CARD_MIN_HEIGHT_CLASS,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div
        className={cn(
          MF_CARD_RADIUS_CLASS,
          MF_COLLECTION_CARD_MIN_HEIGHT_CLASS,
          "relative h-full overflow-hidden border shadow-zynd-low ring-1 ring-inset ring-white/15 transition-all duration-300 ease-out motion-reduce:transition-none",
          "group-hover:-translate-y-1 group-hover:border-white/30 group-hover:shadow-zynd-mid",
          theme.cardClass,
          theme.borderClass,
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -right-6 -top-6 size-28 rounded-full blur-2xl sm:size-32",
            theme.glowClass,
          )}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/35 via-transparent to-transparent opacity-80 dark:from-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
        />

        <div className="absolute left-3 top-3 z-[2]">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full border backdrop-blur-sm shadow-zynd-low sm:size-9",
              theme.iconBadgeClass,
            )}
          >
            <Icon className="size-4 sm:size-[1.125rem]" strokeWidth={2.25} />
          </span>
        </div>

        <div
          className={cn(
            ILLUSTRATION_SLOT_CLASS,
            theme.illustrationSlotClass,
            "z-[1] transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
          )}
        >
          <CollectionIllustration
            illustrationSrc={theme.illustrationSrc}
            scaleClass={theme.illustrationScaleClass}
          />
        </div>

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-[2] px-3.5 pb-3.5 pt-10 sm:px-4 sm:pb-4",
            theme.footerClass,
          )}
        >
          <p
            className={cn(
              "max-w-[calc(100%-2.75rem)] line-clamp-2 text-compact font-bold leading-snug tracking-tight drop-shadow-sm sm:text-body",
              theme.labelClass,
            )}
          >
            {collection.name}
          </p>
          <p
            className={cn(
              "mt-1 hidden max-w-[calc(100%-2.75rem)] line-clamp-1 text-[11px] leading-snug opacity-80 sm:block",
              theme.labelClass,
            )}
          >
            {description}
          </p>
          <span
            className={cn(
              "mt-2 inline-flex h-6 items-center rounded-full border border-white/25 bg-white/18 px-2.5 text-[0.6875rem] font-semibold tabular-nums backdrop-blur-sm",
              theme.labelClass,
            )}
          >
            {fundCountLabel}
          </span>
        </div>

        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-3.5 right-3.5 z-[3] flex size-8 items-center justify-center rounded-full",
            "border border-white/30 bg-white/20 shadow-zynd-low backdrop-blur-md",
            "transition-all duration-300 ease-out group-hover:translate-x-0.5 group-hover:border-white/45 group-hover:bg-white/30 motion-reduce:transition-none",
            theme.labelClass,
          )}
        >
          <ChevronRight className="size-4" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
