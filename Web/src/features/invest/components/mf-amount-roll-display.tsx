"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

type MfAmountRollDisplayProps = {
  fromValue: string;
  toValue: string;
  fontSize: string;
  onComplete?: () => void;
};

export function MfAmountRollDisplay({
  fromValue,
  toValue,
  fontSize,
  onComplete,
}: MfAmountRollDisplayProps) {
  const prefersReducedMotion = useReducedMotion();
  const onCompleteRef = useRef(onComplete);
  const progress = useMotionValue(0);
  const y = useTransform(progress, [0, 1], ["0em", "-1em"]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    progress.set(0);

    if (prefersReducedMotion) {
      onCompleteRef.current?.();
      return;
    }

    const controls = animate(progress, 1, {
      type: "spring",
      stiffness: 540,
      damping: 38,
      mass: 0.62,
      onComplete: () => {
        onCompleteRef.current?.();
      },
    });

    return () => controls.stop();
  }, [fromValue, toValue, prefersReducedMotion, progress]);

  return (
    <div
      className="h-[1em] overflow-hidden leading-none"
      style={{ fontSize, lineHeight: 1 }}
      aria-hidden
    >
      <motion.div style={{ y }} className="will-change-transform">
        <div className="flex h-[1em] items-center font-semibold tabular-nums tracking-tight text-foreground/85">
          {fromValue}
        </div>
        <div className="flex h-[1em] items-center font-semibold tabular-nums tracking-tight text-foreground/85">
          {toValue}
        </div>
      </motion.div>
    </div>
  );
}
