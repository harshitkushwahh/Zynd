"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Copy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { cn } from "@/lib/utils";

export type PersonalInfoSwiperSlide = {
  id: string;
  value: string;
  hint: string;
  hintSecondary?: string;
  ifscCode?: string;
  accountType?: string;
  hintTertiary?: string;
};

type ClientPersonalInfoSwiperTileProps = {
  icon: LucideIcon;
  /** Visible title under the slide value; omit with empty string to hide. */
  label: string;
  /** Accessible name for carousel controls when `label` is hidden. */
  slideLabel?: string;
  slides: PersonalInfoSwiperSlide[];
  emptySlide: PersonalInfoSwiperSlide;
  className?: string;
};

function IfscCopyBadge({ ifscCode }: { ifscCode: string }) {
  const copy = DISTRIBUTOR_CLIENT_COPY.identity;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!ifscCode) return;
    try {
      await navigator.clipboard.writeText(ifscCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [ifscCode]);

  return (
    <button
      type="button"
      className="distributor-client-personal-info-swiper-tile__ifsc-badge"
      onClick={() => void handleCopy()}
      aria-label={copied ? copy.ifscCopied : copy.copyIfsc}
    >
      <span className="distributor-client-personal-info-swiper-tile__ifsc-label">{copy.ifsc}</span>
      <span className="distributor-client-personal-info-swiper-tile__ifsc-value">{ifscCode}</span>
      <span className="distributor-client-personal-info-swiper-tile__ifsc-copy" aria-hidden>
        {copied ? (
          <Check strokeWidth={2.5} className="size-3 distributor-client-personal-info-swiper-tile__ifsc-copy-icon--success" />
        ) : (
          <Copy strokeWidth={2.25} className="size-3" />
        )}
      </span>
    </button>
  );
}

export function ClientPersonalInfoSwiperTile({
  icon: Icon,
  label,
  slideLabel,
  slides,
  emptySlide,
  className,
}: ClientPersonalInfoSwiperTileProps) {
  const items = slides.length > 0 ? slides : [emptySlide];
  const ariaName = slideLabel?.trim() || label.trim() || "Details";
  const [activeIndex, setActiveIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const syncIndexFromScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth <= 0) return;
    const index = Math.round(viewport.scrollLeft / viewport.clientWidth);
    setActiveIndex(Math.min(Math.max(index, 0), items.length - 1));
  }, [items.length]);

  useEffect(() => {
    setActiveIndex(0);
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
    }
  }, [items.length, slides]);

  const goToSlide = (index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ left: index * viewport.clientWidth, behavior: "smooth" });
    setActiveIndex(index);
  };

  return (
    <Card
      className={cn(
        "distributor-client-personal-info-swiper-tile distributor-metric-card--tile h-full w-full overflow-hidden rounded-[var(--radius-5xl)] ring-0",
        className,
      )}
    >
      <CardContent className="distributor-metric-card__body distributor-metric-card__body--tile distributor-client-personal-info-swiper-tile__body h-full">
        <div className="distributor-metric-card__tile-header">
          <span className="distributor-metric-card__tile-icon" aria-hidden>
            <Icon strokeWidth={2.25} />
          </span>
        </div>

        <div
          ref={viewportRef}
          className="distributor-client-personal-info-swiper-tile__viewport"
          onScroll={syncIndexFromScroll}
          tabIndex={items.length > 1 ? 0 : undefined}
          role={items.length > 1 ? "region" : undefined}
          aria-roledescription={items.length > 1 ? "carousel" : undefined}
          aria-label={items.length > 1 ? `${ariaName} carousel` : undefined}
        >
          <div className="distributor-client-personal-info-swiper-tile__track">
            {items.map((slide, index) => (
              <article
                key={slide.id}
                className="distributor-client-personal-info-swiper-tile__slide"
                aria-hidden={index !== activeIndex}
              >
                <div className="distributor-client-personal-info-swiper-tile__main">
                  <p className="distributor-client-personal-info-swiper-tile__title">{slide.value}</p>
                  {label ? (
                    <p className="distributor-client-personal-info-swiper-tile__subtitle">{label}</p>
                  ) : null}
                  <div className="distributor-client-personal-info-swiper-tile__details">
                    <p className="distributor-client-personal-info-swiper-tile__detail">{slide.hint}</p>
                    {slide.ifscCode ? (
                      <IfscCopyBadge ifscCode={slide.ifscCode} />
                    ) : slide.hintSecondary ? (
                      <p className="distributor-client-personal-info-swiper-tile__detail distributor-client-personal-info-swiper-tile__detail--secondary">
                        {slide.hintSecondary}
                      </p>
                    ) : null}
                    {slide.hintTertiary ? (
                      <p className="distributor-client-personal-info-swiper-tile__detail distributor-client-personal-info-swiper-tile__detail--secondary">
                        {slide.hintTertiary}
                      </p>
                    ) : null}
                    {slide.accountType ? (
                      <p className="distributor-client-personal-info-swiper-tile__account-type">
                        {slide.accountType}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {items.length > 1 ? (
          <div
            className="distributor-client-personal-info-swiper-tile__dots"
            role="tablist"
            aria-label={`${ariaName} pages`}
          >
            {items.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`${ariaName} ${index + 1} of ${items.length}`}
                className={cn(
                  "distributor-client-personal-info-swiper-tile__dot",
                  index === activeIndex &&
                    "distributor-client-personal-info-swiper-tile__dot--active",
                )}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
