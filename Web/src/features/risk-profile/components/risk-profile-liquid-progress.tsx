"use client";

import { useReducedMotion, useSpring, useMotionValueEvent } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

const PROGRESS_HEIGHT = 36;

type RiskProfileLiquidProgressProps = {
  current: number;
  total: number;
  label?: string;
  complete?: boolean;
  className?: string;
};

function usePrimaryColor() {
  const [color, setColor] = useState("hsl(221 83% 53%)");

  useEffect(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    probe.style.display = "none";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    if (resolved) setColor(resolved);
  }, []);

  return color;
}

type LiquidWaveFillProps = {
  fillPercent: number;
  width: number;
  height: number;
  waveColor: string;
  animateWaves: boolean;
};

function LiquidWaveFill({ fillPercent, width, height, waveColor, animateWaves }: LiquidWaveFillProps) {
  const clipId = useId();
  const pathRef = useRef<SVGPathElement>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const fillWidth = Math.max(0, Math.min(width, (width * fillPercent) / 100));

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    if (fillWidth <= 0) {
      path.setAttribute("d", "");
      return;
    }

    const amplitude = 2;
    const frequency = 2.5;
    const start = performance.now();

    const draw = (time: number) => {
      const phase = animateWaves ? (time - start) / 1500 : 0;
      const edgeX = fillWidth;
      const points: string[] = [];

      for (let y = 0; y <= height; y += 1) {
        const waveOffset =
          edgeX +
          Math.sin((y / height) * Math.PI * frequency + phase * Math.PI * 2) * amplitude;
        points.push(`${waveOffset.toFixed(2)},${y}`);
      }

      path.setAttribute("d", `M 0 0 L ${points.join(" L ")} L 0 ${height} Z`);

      if (animateWaves) {
        frameRef.current = requestAnimationFrame(draw);
      }
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [animateWaves, fillWidth, height]);

  if (fillWidth <= 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0"
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} rx={height / 2} ry={height / 2} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path ref={pathRef} fill={waveColor} />
      </g>
    </svg>
  );
}

export function RiskProfileLiquidProgress({
  current,
  total,
  label,
  complete = false,
  className,
}: RiskProfileLiquidProgressProps) {
  const safeTotal = Math.max(total, 1);
  const targetPercent = complete ? 100 : Math.min(100, (current / safeTotal) * 100);
  const reducedMotion = useReducedMotion();
  const primaryColor = usePrimaryColor();
  const fillSpring = useSpring(targetPercent, { stiffness: 140, damping: 22, mass: 0.35 });
  const [fillPercent, setFillPercent] = useState(targetPercent);

  useMotionValueEvent(fillSpring, "change", (latest) => {
    setFillPercent(latest);
  });

  useEffect(() => {
    fillSpring.set(targetPercent);
  }, [fillSpring, targetPercent]);

  const displayLabel =
    label ??
    (complete
      ? copy.riskProfile.navbarAssessmentComplete
      : copy.riskProfile.navbarStepsCompleted(current, total));

  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setTrackWidth(element.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [displayLabel]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex h-10 w-auto min-w-[6.5rem] max-w-full overflow-hidden rounded-[var(--radius-full)] border border-border/70 bg-muted/30",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={complete ? total : current}
      aria-label={displayLabel}
    >
      {trackWidth > 0 ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <LiquidWaveFill
            fillPercent={fillPercent}
            width={trackWidth}
            height={PROGRESS_HEIGHT}
            waveColor={primaryColor}
            animateWaves={!reducedMotion}
          />
        </div>
      ) : null}

      <div className="pointer-events-none relative z-10 flex items-center justify-center px-3">
        <span
          className={cn(
            "whitespace-nowrap rounded-[var(--radius-full)] bg-background/95 px-2 py-0.5 text-[11px] font-semibold leading-tight tracking-tight shadow-[0_0_0_1px_color-mix(in_srgb,var(--border)_60%,transparent)]",
            complete ? "text-primary" : "text-foreground",
          )}
        >
          {displayLabel}
        </span>
      </div>
    </div>
  );
}
