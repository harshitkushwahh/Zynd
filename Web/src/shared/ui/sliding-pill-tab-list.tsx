"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export type SlidingPillTab<T extends string> = {
  id: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
};

type SlidingPillTabListProps<T extends string> = {
  tabs: SlidingPillTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  tabClassName?: string;
  /** equal: same-width columns; compact: shrink-wrap each tab (portfolio header). */
  layout?: "equal" | "compact";
};

const defaultTabClass =
  "relative z-10 inline-flex min-w-0 items-center justify-center rounded-full px-2 py-1.5 text-[11px] font-medium transition-[color,opacity] duration-200 ease-out sm:px-2.5 sm:text-caption";

type PillMetrics = { left: number; width: number };

export function SlidingPillTabList<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
  tabClassName = defaultTabClass,
  layout = "equal",
}: SlidingPillTabListProps<T>) {
  const reduceMotion = useReducedMotion();
  const [pendingValue, setPendingValue] = useState<T | null>(null);
  const count = tabs.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const [compactPill, setCompactPill] = useState<PillMetrics>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    if (pendingValue !== null && value === pendingValue) {
      setPendingValue(null);
    }
  }, [pendingValue, value]);

  const selected = pendingValue ?? value;
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selected),
  );

  const measureCompactPill = useCallback(() => {
    if (layout !== "compact") return;
    const container = containerRef.current;
    const button = tabRefs.current.get(selected);
    if (!container || !button) return;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    setCompactPill({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    });
  }, [layout, selected]);

  useLayoutEffect(() => {
    measureCompactPill();
  }, [measureCompactPill, tabs]);

  useLayoutEffect(() => {
    if (layout !== "compact") return;
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measureCompactPill());
    observer.observe(container);
    window.addEventListener("resize", measureCompactPill);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureCompactPill);
    };
  }, [layout, measureCompactPill]);

  const pillTransition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : layout === "compact"
          ? { type: "tween" as const, duration: 0.22, ease: [0.4, 0, 0.2, 1] as const }
          : { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.75 },
    [layout, reduceMotion],
  );

  function selectTab(next: T) {
    const tab = tabs.find((item) => item.id === next);
    if (!tab || tab.disabled || selected === next) return;
    setPendingValue(next);
    onChange(next);
  }

  if (count === 0) return null;

  const isCompact = layout === "compact";

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative gap-0 rounded-full border border-border/80 bg-muted/20 p-0.5",
        isCompact ? "inline-flex max-w-full flex-wrap justify-end" : "grid min-w-0",
        className,
      )}
      style={isCompact ? undefined : { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {isCompact ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-full bg-foreground shadow-zynd-low will-change-[transform,width]"
          initial={false}
          animate={{
            left: compactPill.left,
            width: compactPill.width,
            opacity: compactPill.width > 0 ? 1 : 0,
          }}
          transition={pillTransition}
        />
      ) : (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-foreground shadow-zynd-low will-change-transform"
          style={{ width: `calc((100% - 0.25rem) / ${count})` }}
          initial={false}
          animate={{ x: `${selectedIndex * 100}%` }}
          transition={pillTransition}
        />
      )}

      {tabs.map((tab) => {
        const active = selected === tab.id;
        const enabled = !tab.disabled;

        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) tabRefs.current.set(tab.id, node);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={!enabled}
            disabled={!enabled}
            title={tab.title}
            onClick={() => selectTab(tab.id)}
            className={cn(
              tabClassName,
              active && enabled
                ? "text-background"
                : enabled
                  ? "text-muted-foreground hover:text-foreground"
                  : "cursor-not-allowed text-muted-foreground/45",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
