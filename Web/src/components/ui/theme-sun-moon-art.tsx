"use client";

import { cn } from "@/lib/utils";

export function ThemeSunMoonOrbArt() {
  return (
    <>
      <svg className="zynd-theme-switch-moon-dot zynd-theme-switch-moon-dot-1" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-moon-dot zynd-theme-switch-moon-dot-2" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-moon-dot zynd-theme-switch-moon-dot-3" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-light-ray zynd-theme-switch-light-ray-1" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-light-ray zynd-theme-switch-light-ray-2" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-light-ray zynd-theme-switch-light-ray-3" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
    </>
  );
}

export function ThemeSunMoonCloudArt() {
  return (
    <>
      <svg className="zynd-theme-switch-cloud-dark zynd-theme-switch-cloud-1" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-cloud-dark zynd-theme-switch-cloud-2" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-cloud-dark zynd-theme-switch-cloud-3" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-cloud-light zynd-theme-switch-cloud-4" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-cloud-light zynd-theme-switch-cloud-5" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
      <svg className="zynd-theme-switch-cloud-light zynd-theme-switch-cloud-6" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="50" />
      </svg>
    </>
  );
}

export function ThemeSunMoonStarArt() {
  return (
    <>
      <svg className="zynd-theme-switch-star zynd-theme-switch-star-1" viewBox="0 0 20 20" aria-hidden>
        <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
      </svg>
      <svg className="zynd-theme-switch-star zynd-theme-switch-star-2" viewBox="0 0 20 20" aria-hidden>
        <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
      </svg>
      <svg className="zynd-theme-switch-star zynd-theme-switch-star-3" viewBox="0 0 20 20" aria-hidden>
        <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
      </svg>
      <svg className="zynd-theme-switch-star zynd-theme-switch-star-4" viewBox="0 0 20 20" aria-hidden>
        <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
      </svg>
    </>
  );
}

type ThemeTransitionOrbProps = {
  isDark: boolean;
  className?: string;
};

/** Sun/moon orb artwork only — for full-screen theme transition overlay. */
export function ThemeTransitionOrb({ isDark, className }: ThemeTransitionOrbProps) {
  return (
    <div
      className={cn("zynd-theme-orb-scene", isDark && "zynd-theme-orb-scene-dark", className)}
      aria-hidden
    >
      <ThemeSunMoonCloudArt />
      <div className="zynd-theme-orb">
        <ThemeSunMoonOrbArt />
      </div>
      <div className="zynd-theme-orb-stars">
        <ThemeSunMoonStarArt />
      </div>
    </div>
  );
}
