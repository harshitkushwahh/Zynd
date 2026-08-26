"use client";

import {
  ThemeSunMoonCloudArt,
  ThemeSunMoonOrbArt,
  ThemeSunMoonStarArt,
} from "@/components/ui/theme-sun-moon-art";
import { cn } from "@/lib/utils";

type ThemeSwitchVisualProps = {
  checked: boolean;
  className?: string;
  /** When false, renders a non-interactive display (overlay). */
  interactive?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  ariaLabel?: string;
};

export function ThemeSwitchVisual({
  checked,
  className,
  interactive = false,
  onCheckedChange,
  ariaLabel,
}: ThemeSwitchVisualProps) {
  const slider = (
    <div className="zynd-theme-switch-slider zynd-theme-switch-round">
      <div className="zynd-theme-switch-sun-moon">
        <ThemeSunMoonOrbArt />
        <ThemeSunMoonCloudArt />
      </div>
      <div className="zynd-theme-switch-stars" aria-hidden>
        <ThemeSunMoonStarArt />
      </div>
    </div>
  );

  if (interactive) {
    return (
      <label className={cn("zynd-theme-switch", className)}>
        <input
          type="checkbox"
          className="zynd-theme-switch-input"
          checked={checked}
          onChange={() => onCheckedChange?.(!checked)}
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel}
        />
        {slider}
      </label>
    );
  }

  return (
    <div className={cn("zynd-theme-switch zynd-theme-switch-display", className)} aria-hidden>
      <input
        type="checkbox"
        className="zynd-theme-switch-input"
        checked={checked}
        readOnly
        tabIndex={-1}
      />
      {slider}
    </div>
  );
}
