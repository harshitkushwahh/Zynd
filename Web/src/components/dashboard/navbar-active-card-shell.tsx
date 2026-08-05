"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { DASHBOARD_NAV_CLUSTER_CLASS } from "@/components/dashboard/dashboard-layout";
import { cn } from "@/lib/utils";

type NavbarActiveCardShellProps = {
  measureKey: string;
  children: ReactNode;
  className?: string;
};

/** Animates cluster width when route/card content changes to avoid navbar jitter. */
export function NavbarActiveCardShell({
  measureKey,
  children,
  className,
}: NavbarActiveCardShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let frameId = 0;

    const syncWidth = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        shell.style.width = "auto";
        setWidth(shell.offsetWidth);
      });
    };

    syncWidth();

    const observer = new ResizeObserver(syncWidth);
    observer.observe(shell);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [measureKey]);

  return (
    <div
      ref={shellRef}
      className={cn(
        DASHBOARD_NAV_CLUSTER_CLASS,
        "max-w-[min(100%,14.5rem)] justify-center overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        className,
      )}
      style={width != null ? { width } : undefined}
    >
      <div className="flex w-full min-w-0 items-center justify-center">{children}</div>
    </div>
  );
}
