"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION,
  type DistributorReportBookCompositionRow,
} from "@/lib/distributor-reports-data";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

const BOOK_COMPOSITION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const CHIPS_SCROLL_STEP_PX = 140;

type InsightPlotTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ name?: string; value?: number; dataKey?: string }>;
};

function BookCompositionPlotTooltip({ active, label, payload }: InsightPlotTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="distributor-reports-insight-chart__plot-tooltip">
      {label ? <p className="distributor-reports-insight-chart__plot-tooltip-label">{label}</p> : null}
      <ul className="distributor-reports-insight-chart__plot-tooltip-list">
        {payload.map((entry) => {
          const value = Number(entry.value ?? 0);
          const name = entry.name ?? entry.dataKey ?? "Value";
          return (
            <li key={`${name}-${entry.dataKey}`} className="distributor-reports-insight-chart__plot-tooltip-row">
              <span>{name}</span>
              <span className="tabular-nums">{formatAum(value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function renderBookCompositionPlotTooltip(props: unknown) {
  return <BookCompositionPlotTooltip {...(props as InsightPlotTooltipProps)} />;
}

type DistributorReportsBookCompositionChartProps = {
  chartHeight: number;
};

export function DistributorReportsBookCompositionChart({
  chartHeight,
}: DistributorReportsBookCompositionChartProps) {
  const chipsRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = chipsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = chipsRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  const scrollChips = (direction: "left" | "right") => {
    chipsRef.current?.scrollBy({
      left: direction === "left" ? -CHIPS_SCROLL_STEP_PX : CHIPS_SCROLL_STEP_PX,
      behavior: "smooth",
    });
  };

  const activeEntry = useMemo(
    () => DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION.find((row) => row.id === activeId) ?? null,
    [activeId],
  );

  const activeColor = useMemo(() => {
    if (!activeEntry) return null;
    const index = DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION.findIndex((row) => row.id === activeEntry.id);
    return BOOK_COMPOSITION_COLORS[index % BOOK_COMPOSITION_COLORS.length];
  }, [activeEntry]);

  const totalAmount = useMemo(
    () => DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION.reduce((sum, row) => sum + row.amount, 0),
    [],
  );

  const toggleChip = (entryId: string) => {
    setActiveId((current) => (current === entryId ? null : entryId));
  };

  const chipsAreaHeight = 40;
  const pieHeight = Math.max(chartHeight - chipsAreaHeight - 4, 200);

  return (
    <div className="distributor-reports-book-composition">
      <div className="distributor-reports-book-composition__chart-row" style={{ height: pieHeight }}>
        <div className="distributor-reports-book-composition__chart-wrap">
          <div className="distributor-reports-book-composition__chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION}
                  dataKey="amount"
                  nameKey="label"
                  cx="44%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="94%"
                  paddingAngle={2}
                >
                  {DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION.map((entry, index) => (
                    <Cell
                      key={entry.id}
                      fill={BOOK_COMPOSITION_COLORS[index % BOOK_COMPOSITION_COLORS.length]}
                      opacity={activeId && activeId !== entry.id ? 0.32 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip content={renderBookCompositionPlotTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <aside className="distributor-reports-book-composition__detail" aria-live="polite">
            <div
              className={cn(
                "distributor-reports-book-composition__detail-box",
                activeEntry && "distributor-reports-book-composition__detail-box--selected",
              )}
              style={activeColor ? { "--book-composition-accent": activeColor } as React.CSSProperties : undefined}
            >
              {activeEntry ? (
                <>
                  <div className="distributor-reports-book-composition__detail-head">
                    <span
                      className="distributor-reports-book-composition__detail-swatch"
                      style={{ backgroundColor: activeColor ?? undefined }}
                      aria-hidden
                    />
                    <span className="distributor-reports-book-composition__detail-eyebrow">Category</span>
                  </div>
                  <p className="distributor-reports-book-composition__detail-value tabular-nums">
                    {formatAum(activeEntry.amount)}
                  </p>
                  <p className="distributor-reports-book-composition__detail-label">{activeEntry.label}</p>
                  <span className="distributor-reports-book-composition__detail-badge tabular-nums">
                    {activeEntry.sharePct}% of book
                  </span>
                </>
              ) : (
                <>
                  <span className="distributor-reports-book-composition__detail-eyebrow">Overview</span>
                  <p className="distributor-reports-book-composition__detail-value tabular-nums">
                    {formatAum(totalAmount)}
                  </p>
                  <p className="distributor-reports-book-composition__detail-label">Total book</p>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="distributor-reports-book-composition__chips-bar">
        <button
          type="button"
          className="distributor-reports-book-composition__pager-btn"
          aria-label="Scroll categories left"
          disabled={!canScrollLeft}
          onClick={() => scrollChips("left")}
        >
          <ChevronLeft className="size-3.5" strokeWidth={2.25} />
        </button>

        <div
          ref={chipsRef}
          className="distributor-reports-book-composition__chips-scroll"
          role="list"
          aria-label="Book composition categories"
        >
          {DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION.map((entry, index) => (
            <BookCompositionChip
              key={entry.id}
              entry={entry}
              color={BOOK_COMPOSITION_COLORS[index % BOOK_COMPOSITION_COLORS.length]}
              active={activeId === entry.id}
              onSelect={() => toggleChip(entry.id)}
            />
          ))}
        </div>

        <button
          type="button"
          className="distributor-reports-book-composition__pager-btn"
          aria-label="Scroll categories right"
          disabled={!canScrollRight}
          onClick={() => scrollChips("right")}
        >
          <ChevronRight className="size-3.5" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

function BookCompositionChip({
  entry,
  color,
  active,
  onSelect,
}: {
  entry: DistributorReportBookCompositionRow;
  color: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="listitem"
      className={cn(
        "distributor-reports-book-composition__chip",
        active && "distributor-reports-book-composition__chip--active",
      )}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span
        className="distributor-reports-book-composition__chip-swatch"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="distributor-reports-book-composition__chip-label">{entry.label}</span>
      <span className="distributor-reports-book-composition__chip-pct tabular-nums">{entry.sharePct}%</span>
    </button>
  );
}
