"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { GOAL_TEMPLATE_SCROLL_ROW_CLASS } from "@/features/goals/lib/goal-template-meta";
import { cn } from "@/lib/utils";

type GoalTemplateScrollRowProps = {
  children: ReactNode;
  className?: string;
};

export function GoalTemplateScrollRow({ children, className }: GoalTemplateScrollRowProps) {
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
    <div className="relative min-w-0 overflow-visible py-1">
      <div ref={scrollRef} className={cn(GOAL_TEMPLATE_SCROLL_ROW_CLASS, className)}>
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-1 left-0 z-10 w-8 bg-gradient-to-r from-background from-15% via-background/35 to-transparent transition-opacity duration-300 sm:w-12",
          showLeftFade ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-1 right-0 z-10 w-8 bg-gradient-to-l from-background from-15% via-background/35 to-transparent transition-opacity duration-300 sm:w-12",
          showRightFade ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
