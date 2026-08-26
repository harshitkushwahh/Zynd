import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TabPanelProps = {
  active: boolean;
  children: ReactNode;
  className?: string;
  keepMounted?: boolean;
  /** Crossfade between stacked panels; parent should be `relative` with bounded height. */
  fade?: boolean;
};

/** Keeps tab panel content mounted and toggles visibility without layout thrash. */
export function TabPanel({
  active,
  children,
  className,
  keepMounted = true,
  fade = false,
}: TabPanelProps) {
  if (!keepMounted && !active) {
    return null;
  }

  if (fade) {
    return (
      <div
        role="tabpanel"
        aria-hidden={!active}
        className={cn(
          "absolute inset-0 flex min-h-0 flex-col overflow-hidden transition-opacity duration-200 ease-out motion-reduce:transition-none",
          active ? "z-[1] opacity-100" : "pointer-events-none z-0 opacity-0",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      role="tabpanel"
      hidden={!active}
      aria-hidden={!active}
      className={cn(!active && "hidden", className)}
    >
      {children}
    </div>
  );
}

export const TAB_PILL_ACTIVE_CLASS =
  "bg-foreground text-background shadow-zynd-low";
export const TAB_PILL_INACTIVE_CLASS =
  "text-muted-foreground hover:bg-muted/40 hover:text-foreground";
export const TAB_PILL_BASE_CLASS =
  "transition-colors duration-200 ease-out motion-reduce:transition-none";
