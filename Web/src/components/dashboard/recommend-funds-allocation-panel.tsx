"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

import type { OverviewAllocationSlice } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { RechartsMeasuredContainer } from "@/components/ui/recharts-measured-container";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const RECOMMEND_FUNDS_ALLOCATION_FILLS: Record<string, string> = {
  equity: "#38bdf8",
  debt: "#34d399",
  hybrid: "#fbbf24",
  gold: "#fb7185",
};

export type RecommendFundsAllocationChartSlice = OverviewAllocationSlice & {
  fill: string;
};

export function recommendFundsAllocationChartFill(slice: OverviewAllocationSlice) {
  return RECOMMEND_FUNDS_ALLOCATION_FILLS[slice.id] ?? "#c4b5fd";
}

export function mapRecommendFundsAllocationChartSlices(
  slices: readonly OverviewAllocationSlice[],
): RecommendFundsAllocationChartSlice[] {
  return slices.map((slice) => ({
    ...slice,
    fill: recommendFundsAllocationChartFill(slice),
  }));
}

type AllocationDonutTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: RecommendFundsAllocationChartSlice }>;
};

function AllocationDonutTooltip({ active, payload }: AllocationDonutTooltipProps) {
  if (!active || !payload?.length) return null;

  const slice = payload[0]?.payload;
  if (!slice) return null;

  return (
    <div className="recommend-funds-popover-allocation-tooltip">
      <p className="recommend-funds-popover-allocation-tooltip-label">{slice.label}</p>
      <p className="recommend-funds-popover-allocation-tooltip-value">{slice.valuePct}%</p>
    </div>
  );
}

function renderAllocationDonutTooltip(props: unknown) {
  return <AllocationDonutTooltip {...(props as AllocationDonutTooltipProps)} />;
}

type RecommendFundsAllocationDonutProps = {
  slices: RecommendFundsAllocationChartSlice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function RecommendFundsAllocationDonut({
  slices,
  selectedId,
  onSelect,
}: RecommendFundsAllocationDonutProps) {
  const activeIndex = selectedId ? slices.findIndex((slice) => slice.id === selectedId) : -1;
  const hasSelection = selectedId !== null;

  return (
    <div className="recommend-funds-popover-allocation-chart recommend-funds-popover-allocation-chart-lg">
      <RechartsMeasuredContainer className="size-full" width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Tooltip
            content={renderAllocationDonutTooltip}
            wrapperStyle={{ zIndex: 60, pointerEvents: "none" }}
          />
          <Pie
            data={slices}
            dataKey="valuePct"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={2}
            stroke="rgb(255 255 255 / 22%)"
            strokeWidth={2}
            activeIndex={activeIndex >= 0 ? activeIndex : undefined}
            isAnimationActive={false}
            onClick={(_, index) => {
              const slice = slices[index];
              if (slice) onSelect(slice.id);
            }}
          >
            {slices.map((slice) => (
              <Cell
                key={slice.id}
                fill={slice.fill}
                fillOpacity={!hasSelection || selectedId === slice.id ? 1 : 0.38}
                className="cursor-pointer outline-none transition-[fill-opacity] duration-200"
              />
            ))}
          </Pie>
        </PieChart>
      </RechartsMeasuredContainer>
    </div>
  );
}

function RecommendFundsAllocationChipSwiper({
  slices,
  selectedId,
  onToggle,
}: {
  slices: readonly RecommendFundsAllocationChartSlice[];
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
    chipRefs.current[selectedId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedId]);

  const scrollByStep = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * 96, behavior: "smooth" });
  };

  return (
    <div className="recommend-funds-popover-allocation-chip-swiper">
      <button
        type="button"
        aria-label="Scroll allocation left"
        onClick={() => scrollByStep(-1)}
        disabled={!canScrollLeft}
        className={cn(
          "recommend-funds-popover-allocation-chip-arrow",
          !canScrollLeft && "recommend-funds-popover-allocation-chip-arrow-disabled",
        )}
      >
        <ChevronLeft className="size-3.5" strokeWidth={2.25} />
      </button>

      <div ref={scrollRef} className="recommend-funds-popover-allocation-chip-track scrollbar-none">
        {slices.map((slice) => {
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
                "recommend-funds-popover-allocation-chip",
                active && "recommend-funds-popover-allocation-chip-active",
              )}
            >
              <span
                className="recommend-funds-popover-allocation-chip-dot"
                style={{ backgroundColor: slice.fill }}
                aria-hidden
              />
              <span className="recommend-funds-popover-allocation-chip-label">{slice.label}</span>
              <span className="recommend-funds-popover-allocation-chip-value">{slice.valuePct}%</span>
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
          "recommend-funds-popover-allocation-chip-arrow",
          !canScrollRight && "recommend-funds-popover-allocation-chip-arrow-disabled",
        )}
      >
        <ChevronRight className="size-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

type RecommendFundsAllocationPanelProps = {
  slices: readonly OverviewAllocationSlice[];
};

export function RecommendFundsAllocationPanel({
  slices,
}: RecommendFundsAllocationPanelProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const chartSlices = useMemo(() => mapRecommendFundsAllocationChartSlices(slices), [slices]);
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
    <div className="recommend-funds-popover-allocation-panel">
      <p className="recommend-funds-popover-allocation-title">{portfolioCopy.allocationTitle}</p>

      <div className="recommend-funds-popover-allocation-chart-wrap">
        <RecommendFundsAllocationDonut
          slices={chartSlices}
          selectedId={selectedId}
          onSelect={toggleSelection}
        />
        <div className="recommend-funds-popover-allocation-chart-center" aria-hidden>
          {centerPctLabel}
        </div>
      </div>

      <RecommendFundsAllocationChipSwiper
        slices={chartSlices}
        selectedId={selectedId}
        onToggle={toggleSelection}
      />
    </div>
  );
}

export const RECOMMENDED_BASKET_ALLOCATION: OverviewAllocationSlice[] = [
  { id: "equity", label: "Equity", valuePct: 72, color: "#38bdf8" },
  { id: "debt", label: "Debt", valuePct: 18, color: "#34d399" },
  { id: "hybrid", label: "Hybrid", valuePct: 6, color: "#fbbf24" },
  { id: "gold", label: "Gold", valuePct: 4, color: "#fb7185" },
];
