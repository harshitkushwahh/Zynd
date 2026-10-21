"use client";

import ShapeGrid from "@/components/ui/shape-grid";
import { useTheme } from "@/contexts/theme-context";

export function AuthDialogShapeGrid({ interactive = true }: { interactive?: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden bg-muted/10"
      aria-hidden={!interactive}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-popover/30 via-popover/45 to-popover/88"
        aria-hidden
      />
      <div className={interactive ? "absolute inset-0 z-[1]" : "pointer-events-none absolute inset-0 z-[1]"}>
        <ShapeGrid
          className="h-full w-full"
          shape="square"
          direction="diagonal"
          lineColor={isDark ? "#52525b" : "#e4e4e7"}
          hoverColor={isDark ? "#fafafa" : "#18181b"}
          hoverFillColor={isDark ? "#fafafa" : "#18181b"}
          fillOpacity={0.18}
          cellSize={32}
          speed={0.2}
          tiltX={0}
          tiltY={0}
          rainbow={false}
          clickCascade={false}
          intro={false}
          interactive={interactive}
          twinkle={0}
          radius={1.35}
          glow={0.35}
          fade={0.5}
          trail={0.5}
        />
      </div>
    </div>
  );
}
