"use client";

import { useId, useMemo, useState } from "react";

import { resolveAmcLogoUrl } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const GROWTH_SERIES = [42, 44, 43, 46, 48, 47, 51, 53, 52, 56, 58, 62] as const;

function DummyGrowthChart({ className, gradientId }: { className?: string; gradientId: string }) {
  const { path, area } = useMemo(() => {
    const width = 88;
    const height = 40;
    const padding = 2;
    const min = Math.min(...GROWTH_SERIES);
    const max = Math.max(...GROWTH_SERIES);
    const range = max - min || 1;

    const coords = GROWTH_SERIES.map((value, index) => {
      const x = padding + (index / (GROWTH_SERIES.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return { x, y };
    });

    const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const areaPath = `${line} L ${coords[coords.length - 1]?.x ?? 0} ${height} L ${coords[0]?.x ?? 0} ${height} Z`;

    return { path: line, area: areaPath };
  }, []);

  return (
    <svg viewBox="0 0 88 40" className={cn("shrink-0 text-success", className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function AmcLogoMark({ name, slug }: { name: string; slug: string }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = resolveAmcLogoUrl(null, slug);

  if (!logoUrl || failed) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-bold text-muted-foreground">
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      className="size-8 shrink-0 rounded-md border border-border bg-background object-contain p-0.5"
      onError={() => setFailed(true)}
    />
  );
}

export function HomeHeroMfPreviewCard() {
  const preview = copy.marketing.homeHero.portfolioPreview;
  const gradientId = useId().replace(/:/g, "");

  return (
    <div className="landing-hero-mf-preview absolute left-1/2 z-20 w-[min(92%,16.5rem)] -translate-x-1/2 rounded-[var(--radius-card)] border border-border bg-card p-3 shadow-zynd-mid">
      <div className="flex items-center justify-between gap-2">
        <AmcLogoMark name={preview.amcName} slug={preview.amcSlug} />
        <p className="text-compact font-semibold tabular-nums text-success">{preview.growthValue}</p>
      </div>

      <div className="mt-2.5 flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-compact font-semibold leading-snug text-foreground">
            {preview.fundName}
          </p>
          <p className="mt-0.5 text-caption text-muted-foreground">{preview.growthLabel}</p>
        </div>
        <DummyGrowthChart gradientId={gradientId} className="h-10 w-[5.5rem]" />
      </div>
    </div>
  );
}
