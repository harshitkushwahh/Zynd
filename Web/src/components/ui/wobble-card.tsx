"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

const WOBBLE_MAX_OFFSET = 8;

type WobbleCardProps = {
  children: ReactNode;
  containerClassName?: string;
  className?: string;
};

function clampWobble(value: number) {
  return Math.max(-WOBBLE_MAX_OFFSET, Math.min(WOBBLE_MAX_OFFSET, value));
}

export function WobbleCard({ children, containerClassName, className }: WobbleCardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    const { clientX, clientY } = event;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clampWobble((clientX - (rect.left + rect.width / 2)) / 24);
    const y = clampWobble((clientY - (rect.top + rect.height / 2)) / 24);
    setMousePosition({ x, y });
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setMousePosition({ x: 0, y: 0 });
      }}
      className={cn(
        "relative w-full overflow-hidden rounded-[var(--radius-medium)]",
        containerClassName
      )}
    >
      <div
        className="relative h-full [background-image:radial-gradient(88%_100%_at_top,rgba(255,255,255,0.18),rgba(255,255,255,0))] px-4 py-5 sm:px-5 sm:py-6"
        style={{
          boxShadow:
            "0px -11px 50px 0px rgba(0, 0, 0, 0.18), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.12)",
        }}
      >
        <motion.div
          style={{
            transform: isHovering
              ? `translate3d(${-mousePosition.x}px, ${-mousePosition.y}px, 0)`
              : "translate3d(0px, 0px, 0)",
            transition: "transform 0.1s ease-out",
          }}
          className={cn("relative h-full", className)}
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}
