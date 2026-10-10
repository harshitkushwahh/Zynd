"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type {
  SupportClientCapturedField,
  SupportClientCapturedSlide,
} from "@/lib/support-client-captured-profile-model";
import { cn } from "@/lib/utils";

type ClientProfileCapturedStructuredCardProps = {
  sectionLabel: string;
  icon?: LucideIcon;
  verified?: boolean;
  slideVerified?: boolean[];
  fields?: SupportClientCapturedField[];
  slides?: SupportClientCapturedSlide[];
  prefixFields?: SupportClientCapturedField[];
  carouselAriaLabel?: string;
  className?: string;
};

export function ClientProfileCapturedStructuredCard({
  sectionLabel,
  icon: Icon,
  verified,
  slideVerified,
  fields,
  slides,
  prefixFields,
  carouselAriaLabel,
  className,
}: ClientProfileCapturedStructuredCardProps) {
  const carouselSlides = slides && slides.length > 0 ? slides : null;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);

  const syncIndexFromScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth <= 0) return;
    const index = Math.round(viewport.scrollLeft / viewport.clientWidth);
    const max = (carouselSlides?.length ?? 1) - 1;
    setActiveIndex(Math.min(Math.max(index, 0), max));
  }, [carouselSlides?.length]);

  const syncSlideWidths = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const width = viewport.clientWidth;
    if (width <= 0) return;
    viewport.querySelectorAll<HTMLElement>("[data-profile-carousel-slide]").forEach((slide) => {
      slide.style.flexBasis = `${width}px`;
      slide.style.width = `${width}px`;
      slide.style.maxWidth = `${width}px`;
    });
  }, []);

  useLayoutEffect(() => {
    setActiveIndex(0);
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollLeft = 0;
    syncSlideWidths();
  }, [carouselSlides?.length, slides, syncSlideWidths]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !carouselSlides || carouselSlides.length < 2) return;

    syncSlideWidths();
    const observer = new ResizeObserver(() => {
      syncSlideWidths();
      syncIndexFromScroll();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [carouselSlides, syncIndexFromScroll, syncSlideWidths]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !carouselSlides || carouselSlides.length < 2) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      viewport.scrollLeft += event.deltaX;
      event.preventDefault();
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [carouselSlides]);

  const goToSlide = (index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ left: index * viewport.clientWidth, behavior: "smooth" });
    setActiveIndex(index);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!carouselSlides || carouselSlides.length < 2) return;
    if (event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
    };
    setIsDragging(true);
    viewport.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport || drag.pointerId !== event.pointerId) return;

    viewport.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX);
  };

  const endPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    setIsDragging(false);
    viewport.releasePointerCapture(event.pointerId);

    const width = viewport.clientWidth;
    if (width > 0) {
      const index = Math.round(viewport.scrollLeft / width);
      viewport.scrollTo({ left: index * width, behavior: "smooth" });
    }
    syncIndexFromScroll();
  };

  const showDots = Boolean(carouselSlides && carouselSlides.length > 1);
  const ariaName = carouselAriaLabel?.trim() || sectionLabel;
  const resolvedVerified =
    slideVerified && carouselSlides
      ? slideVerified[activeIndex] ?? carouselSlides[activeIndex]?.verified
      : verified ?? carouselSlides?.[activeIndex]?.verified;

  return (
    <article
      className={cn(
        "support-client-profile-captured-card support-client-profile-captured-card--structured",
        showDots && "support-client-profile-captured-card--pager",
        resolvedVerified && "support-client-profile-captured-card--verified",
        className,
      )}
    >
      {showDots ? (
        <div
          className="support-client-profile-captured-card__pager"
          role="tablist"
          aria-label={`${ariaName} pages`}
        >
          {carouselSlides!.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`${ariaName} ${index + 1} of ${carouselSlides!.length}`}
              className={cn(
                "support-client-profile-captured-card__dot",
                index === activeIndex && "support-client-profile-captured-card__dot--active",
              )}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      ) : null}

      <div className="support-client-profile-captured-card__head">
        <div className="support-client-profile-captured-card__label-row">
          {Icon ? (
            <span className="support-client-profile-captured-card__icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
          ) : null}
          <span className="support-client-profile-captured-card__label">{sectionLabel}</span>
        </div>
        {resolvedVerified ? (
          <StatusBadge
            variant="success"
            className="support-client-profile-captured-card__verified h-5 shrink-0 px-1.5 text-[9px]"
          >
            Verified
          </StatusBadge>
        ) : null}
      </div>

      <div className="support-client-profile-captured-card__body support-client-profile-captured-card__body--structured">
        {prefixFields?.map((field) => (
          <CapturedFieldRow key={`${field.label}-${field.value.slice(0, 12)}`} field={field} />
        ))}

        {carouselSlides ? (
          <div
            ref={viewportRef}
            className={cn(
              "support-client-profile-captured-card__carousel-viewport",
              showDots && "support-client-profile-captured-card__carousel-viewport--interactive",
              isDragging && "support-client-profile-captured-card__carousel-viewport--dragging",
            )}
            onScroll={syncIndexFromScroll}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointerDrag}
            onPointerCancel={endPointerDrag}
            tabIndex={showDots ? 0 : undefined}
            role={showDots ? "region" : undefined}
            aria-roledescription={showDots ? "carousel" : undefined}
            aria-label={showDots ? `${ariaName} carousel` : undefined}
          >
            {carouselSlides.map((slide, index) => (
              <div
                key={slide.id}
                data-profile-carousel-slide
                className="support-client-profile-captured-card__carousel-slide"
                aria-hidden={index !== activeIndex}
              >
                {slide.fields.map((field) => (
                  <CapturedFieldRow key={`${slide.id}-${field.label}`} field={field} />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {!carouselSlides && fields
          ? fields.map((field) => (
              <CapturedFieldRow key={`${field.label}-${field.value.slice(0, 12)}`} field={field} />
            ))
          : null}
      </div>
    </article>
  );
}

function CapturedFieldRow({ field }: { field: SupportClientCapturedField }) {
  return (
    <div className="support-client-profile-captured-card__field-row">
      {field.label ? (
        <span className="support-client-profile-captured-card__field-label">{field.label}</span>
      ) : null}
      <p
        className={cn(
          "support-client-profile-captured-card__field-value",
          field.mono && "support-client-profile-captured-card__value--mono",
          field.multiline && "support-client-profile-captured-card__value--multiline",
        )}
      >
        {field.value || "Not captured"}
      </p>
    </div>
  );
}
