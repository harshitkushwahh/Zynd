"use client";

import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const MIN_FONT_PX = 11;
const SHRINK_STEP_PX = 0.5;

type DistributorMetricTileFittedValueProps = {
  value: string;
  className?: string;
  title?: string;
};

export function DistributorMetricTileFittedValue({
  value,
  className,
  title,
}: DistributorMetricTileFittedValueProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fit = () => {
      node.style.fontSize = "";
      const maxSizePx = Number.parseFloat(getComputedStyle(node).fontSize);
      if (!Number.isFinite(maxSizePx)) return;

      let sizePx = maxSizePx;
      node.style.fontSize = `${sizePx}px`;

      while (node.scrollWidth > node.clientWidth && sizePx > MIN_FONT_PX) {
        sizePx -= SHRINK_STEP_PX;
        node.style.fontSize = `${sizePx}px`;
      }
    };

    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);

    return () => observer.disconnect();
  }, [value]);

  return (
    <span
      ref={ref}
      className={cn("block max-w-full whitespace-nowrap", className)}
      title={title}
    >
      {value}
    </span>
  );
}
