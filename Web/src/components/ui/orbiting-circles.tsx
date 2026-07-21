"use client";

import React from "react";

import { cn } from "@/lib/utils";

export interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  iconSize?: number;
  speed?: number;
}

export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  delay = 0,
  radius = 160,
  path = true,
  iconSize = 30,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  const calculatedDuration = duration / speed;
  const childCount = React.Children.count(children);

  return (
    <>
      {path ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden
        >
          <circle
            className="stroke-primary/15 stroke-1 dark:stroke-primary-foreground/15"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            strokeDasharray="4 8"
          />
        </svg>
      ) : null}
      {React.Children.map(children, (child, index) => {
        const angle = childCount > 0 ? (360 / childCount) * index : 0;
        return (
          <div
            style={
              {
                "--duration": calculatedDuration,
                "--radius": radius,
                "--angle": angle,
                "--icon-size": `${iconSize}px`,
                animationDelay: `${delay}s`,
              } as React.CSSProperties
            }
            className={cn(
              "animate-orbit absolute left-[calc(50%-var(--icon-size)/2)] top-[calc(50%-var(--icon-size)/2)] flex size-[var(--icon-size)] transform-gpu items-center justify-center",
              reverse && "[animation-direction:reverse]",
              className,
            )}
            {...props}
          >
            {child}
          </div>
        );
      })}
    </>
  );
}
