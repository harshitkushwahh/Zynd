"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const SCROLL_ROW_BASE_CLASS =
  "flex min-w-0 gap-3 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type GoalsHorizontalScrollRowProps = {
  children: ReactNode;
  className?: string;
  /** Classes on the scrolling flex row (padding, gap overrides). */
  scrollClassName?: string;
  /** Position/size of left/right edge fades, e.g. `inset-y-4 bottom-10`. */
  fadeInsetClassName?: string;
};

export function GoalsHorizontalScrollRow({
  children,
  className,
  scrollClassName,
  fadeInsetClassName = "inset-y-2 bottom-5",
}: GoalsHorizontalScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth - clientWidth > 4;

    setShowLeftFade(overflow && scrollLeft > 4);
    setShowRightFade(overflow && scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });

    const observer = new ResizeObserver(updateFades);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateFades);
      observer.disconnect();
    };
  }, [updateFades, children]);

  return (
    <div className={cn("relative min-w-0 overflow-visible", className)}>
      <div ref={scrollRef} className={cn(SCROLL_ROW_BASE_CLASS, scrollClassName)}>
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 z-10 w-8 bg-gradient-to-r from-background from-15% via-background/35 to-transparent transition-opacity duration-300 sm:w-12",
          fadeInsetClassName,
          showLeftFade ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-0 z-10 w-8 bg-gradient-to-l from-background from-15% via-background/35 to-transparent transition-opacity duration-300 sm:w-12",
          fadeInsetClassName,
          showRightFade ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
