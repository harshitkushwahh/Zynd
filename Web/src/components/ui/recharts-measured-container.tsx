"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

type RechartsMeasuredContainerProps = Omit<
  ComponentProps<typeof ResponsiveContainer>,
  "width" | "height"
> & {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  className?: string;
  children: ReactNode;
};

/** Mount ResponsiveContainer only after the parent has non-zero size (avoids Recharts 0×0 warnings). */
export function RechartsMeasuredContainer({
  className,
  width = "100%",
  height = "100%",
  minWidth = 0,
  children,
  ...props
}: RechartsMeasuredContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      setReady(node.clientWidth > 0 && node.clientHeight > 0);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "min-h-0 min-w-0 [&_.recharts-surface]:outline-none [&_.recharts-surface:focus]:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-wrapper:focus]:outline-none",
        className ?? "size-full",
      )}
    >
      {ready ? (
        <ResponsiveContainer width={width} height={height} minWidth={minWidth} {...props}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
