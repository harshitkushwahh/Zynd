"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme, isThemeTransitioning, pendingTheme } = useTheme();
  const displayTheme = pendingTheme ?? theme;
  const isDark = displayTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "relative size-10 overflow-hidden rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
              isThemeTransitioning && "pointer-events-none",
              className,
            )}
            aria-label={label}
            disabled={isThemeTransitioning}
            onClick={() => setTheme(nextTheme)}
          />
        }
      >
        <span className="relative flex size-5 items-center justify-center">
          <Sun
            className={cn(
              "absolute size-[1.125rem] text-amber-500 transition-all duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)]",
              isDark
                ? "scale-50 -rotate-90 opacity-0"
                : "scale-100 rotate-0 opacity-100",
            )}
            strokeWidth={2.25}
          />
          <Moon
            className={cn(
              "absolute size-[1.125rem] transition-all duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)]",
              isDark
                ? "scale-100 rotate-0 opacity-100"
                : "scale-50 rotate-90 opacity-0",
            )}
            strokeWidth={2.25}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
