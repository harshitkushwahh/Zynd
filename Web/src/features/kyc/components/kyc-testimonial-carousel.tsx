"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycTestimonial = {
  quote: string;
  name: string;
  role: string;
  avatarSrc?: string;
};

type KycTestimonialCarouselProps = {
  testimonials: readonly KycTestimonial[];
  className?: string;
};

const SWIPE_THRESHOLD_PX = 40;
const AUTO_ADVANCE_MS = 5500;

function testimonialInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function KycTestimonialAvatar({ testimonial }: { testimonial: KycTestimonial }) {
  const initials = testimonialInitials(testimonial.name);

  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-full border border-primary-foreground/25 bg-primary-foreground/15">
      {testimonial.avatarSrc ? (
        <Image
          src={testimonial.avatarSrc}
          alt=""
          fill
          sizes="56px"
          className="object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-compact font-semibold text-primary-foreground">
          {initials}
        </span>
      )}
    </div>
  );
}

export function KycTestimonialCarousel({ testimonials, className }: KycTestimonialCarouselProps) {
  const count = testimonials.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartX = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (count <= 0) return;
      setActiveIndex(((nextIndex % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;

    const timer = window.setInterval(() => {
      if (pausedRef.current || isDragging) return;
      setActiveIndex((current) => (current + 1) % count);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [count, isDragging]);

  const finishDrag = useCallback(
    (deltaX: number) => {
      if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
        goTo(activeIndex + (deltaX < 0 ? 1 : -1));
      }
      setDragOffset(0);
      setIsDragging(false);
      pointerStartX.current = null;
    },
    [activeIndex, goTo],
  );

  if (count === 0) return null;

  const slideOffsetPercent = count > 0 ? (activeIndex / count) * 100 : 0;

  return (
    <div
      className={cn("flex min-h-0 flex-col", className)}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div
        className="overflow-hidden touch-pan-x"
        onPointerDown={(event) => {
          if (count <= 1) return;
          pointerStartX.current = event.clientX;
          setIsDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!isDragging || pointerStartX.current === null) return;
          setDragOffset(event.clientX - pointerStartX.current);
        }}
        onPointerUp={(event) => {
          if (pointerStartX.current === null) return;
          finishDrag(event.clientX - pointerStartX.current);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (pointerStartX.current === null) return;
          finishDrag(event.clientX - pointerStartX.current);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <div
          className={cn(
            "flex will-change-transform",
            isDragging
              ? "transition-none"
              : "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          )}
          style={{
            width: `${count * 100}%`,
            transform: `translate3d(calc(-${slideOffsetPercent}% + ${dragOffset}px), 0, 0)`,
          }}
        >
          {testimonials.map((testimonial) => (
            <div
              key={`${testimonial.name}-${testimonial.quote}`}
              className="shrink-0 grow-0"
              style={{ width: `${100 / count}%` }}
            >
              <KycTestimonialAvatar testimonial={testimonial} />
              <p className="mt-4 max-w-[280px] text-compact font-medium leading-relaxed text-primary-foreground">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-end justify-between gap-3 pr-1">
                <div className="min-w-0">
                  <p className="truncate text-caption font-semibold text-primary-foreground">
                    {testimonial.name}
                  </p>
                  <p className="truncate text-caption text-primary-foreground/75">{testimonial.role}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 text-primary-foreground/90">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star key={starIndex} className="size-3 fill-current" strokeWidth={0} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {count > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Testimonials">
            {testimonials.map((testimonial, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={`dot-${testimonial.name}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Testimonial ${index + 1}`}
                  onClick={() => goTo(index)}
                  className={cn(
                    "rounded-full transition-all duration-500 ease-out",
                    isActive
                      ? "size-2 bg-primary-foreground"
                      : "size-1.5 bg-primary-foreground/35 hover:bg-primary-foreground/55",
                  )}
                />
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              onPointerDown={(event) => event.stopPropagation()}
              className="flex size-8 items-center justify-center rounded-full border border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground transition-colors hover:bg-primary-foreground/20"
              aria-label={copy.kyc.brandPanel.previousTestimonial}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              onPointerDown={(event) => event.stopPropagation()}
              className="flex size-8 items-center justify-center rounded-full border border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground transition-colors hover:bg-primary-foreground/20"
              aria-label={copy.kyc.brandPanel.nextTestimonial}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
