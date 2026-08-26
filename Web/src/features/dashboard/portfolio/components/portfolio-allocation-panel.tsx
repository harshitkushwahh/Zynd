"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { OverviewAllocationSlice } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { portfolioAllocationChartFill } from "@/features/dashboard/portfolio/lib/portfolio-allocation-colors";
import { mapPortfolioAllocationChartSlices } from "@/features/dashboard/portfolio/components/portfolio-allocation-donut-chart";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PortfolioAllocationDonutChart = dynamic(
  () =>
    import("@/features/dashboard/portfolio/components/portfolio-allocation-donut-chart").then(
      (mod) => mod.PortfolioAllocationDonutChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="size-full animate-pulse rounded-full bg-muted/30" aria-hidden="true" />
    ),
  },
);

type PortfolioAllocationPanelProps = {
  slices: readonly OverviewAllocationSlice[];
  className?: string;
};

function AllocationChipSwiper({
  slices,
  selectedId,
  onToggle,
}: {
  slices: readonly OverviewAllocationSlice[];
  selectedId: string | null;
  onToggle: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth - clientWidth > 4;

    setCanScrollLeft(overflow && scrollLeft > 4);
    setCanScrollRight(overflow && scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [slices, updateScrollState]);

  useEffect(() => {
    if (!selectedId) return;
    const chip = chipRefs.current[selectedId];
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [selectedId]);

  const scrollByStep = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * 112, behavior: "smooth" });
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <button
        type="button"
        aria-label="Scroll allocation left"
        onClick={() => scrollByStep(-1)}
        disabled={!canScrollLeft}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/20 text-muted-foreground transition-colors",
          canScrollLeft ? "hover:bg-muted/40 hover:text-foreground" : "cursor-default opacity-40",
        )}
      >
        <ChevronLeft className="size-3.5" strokeWidth={2.25} />
      </button>

      <div
        ref={scrollRef}
        className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain py-0.5"
      >
        {slices.map((slice) => {
          const fill = portfolioAllocationChartFill(slice);
          const active = selectedId === slice.id;

          return (
            <button
              key={slice.id}
              ref={(node) => {
                chipRefs.current[slice.id] = node;
              }}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(slice.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                active
                  ? "border-foreground/20 bg-foreground text-background shadow-sm"
                  : "border-border/70 bg-muted/10 text-muted-foreground hover:bg-muted/25 hover:text-foreground",
              )}
            >
              <span
                className={cn("size-2 shrink-0 rounded-full", active && "ring-1 ring-background/40")}
                style={{ backgroundColor: fill }}
                aria-hidden
              />
              <span className={cn("whitespace-nowrap", active ? "text-background" : "text-foreground")}>
                {slice.label}
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  active ? "text-background" : "text-foreground",
                )}
              >
                {slice.valuePct}%
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Scroll allocation right"
        onClick={() => scrollByStep(1)}
        disabled={!canScrollRight}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/20 text-muted-foreground transition-colors",
          canScrollRight ? "hover:bg-muted/40 hover:text-foreground" : "cursor-default opacity-40",
        )}
      >
        <ChevronRight className="size-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

export function PortfolioAllocationPanel({ slices, className }: PortfolioAllocationPanelProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const chartSlices = useMemo(() => mapPortfolioAllocationChartSlices(slices), [slices]);
  const selectedSlice = selectedId
    ? chartSlices.find((slice) => slice.id === selectedId)
    : undefined;
  const centerPctLabel = selectedSlice
    ? `${selectedSlice.valuePct}%`
    : slices.length === 0
      ? "0%"
      : "100%";

  const toggleSelection = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  return (
    <section
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "flex w-full max-w-[15rem] flex-col border border-border/60 bg-card p-3.5 shadow-zynd-low sm:max-w-[16rem] sm:p-4",
        className,
      )}
    >
      <h2 className="text-compact font-semibold text-foreground">{portfolioCopy.allocationTitle}</h2>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <div className="relative mx-auto aspect-square w-full max-w-[9rem] sm:max-w-[10.5rem]">
          <PortfolioAllocationDonutChart
            slices={chartSlices}
            selectedId={selectedId}
            onSelect={toggleSelection}
          />
          <div className="pointer-events-none absolute inset-[22%] flex items-center justify-center">
            <p className="text-h4 font-semibold tabular-nums tracking-tight text-foreground">
              {centerPctLabel}
            </p>
          </div>
        </div>

        <div className="mt-auto w-full min-w-0 pt-3">
          <AllocationChipSwiper
            slices={slices}
            selectedId={selectedId}
            onToggle={toggleSelection}
          />
        </div>
      </div>
    </section>
  );
}
