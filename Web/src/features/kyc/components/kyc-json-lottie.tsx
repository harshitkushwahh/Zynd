"use client";

import { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

import { cn } from "@/lib/utils";

type KycJsonLottieProps = {
  /** Remote JSON path — used when animationData is not provided. */
  src?: string;
  /** Preloaded animation JSON (preferred for outcome cards). */
  animationData?: object;
  loop?: boolean;
  /** Keep the last frame visible after a one-shot animation finishes. */
  holdOnComplete?: boolean;
  className?: string;
};

export function KycJsonLottie({
  src,
  animationData: animationDataProp,
  loop = true,
  holdOnComplete = false,
  className,
}: KycJsonLottieProps) {
  const [fetchedAnimationData, setFetchedAnimationData] = useState<object | null>(
    animationDataProp ?? null,
  );
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const animationData = animationDataProp ?? fetchedAnimationData;

  useEffect(() => {
    if (animationDataProp) {
      setFetchedAnimationData(animationDataProp);
      return;
    }
    if (!src) return;

    let cancelled = false;
    fetch(src)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setFetchedAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setFetchedAnimationData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [animationDataProp, src]);

  if (!animationData) {
    return (
      <div
        className={cn("size-[5.5rem] shrink-0 animate-pulse rounded-full bg-muted/40", className)}
        aria-hidden
      />
    );
  }

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={loop}
      autoplay
      rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      onComplete={() => {
        if (!holdOnComplete || loop) return;
        const instance = lottieRef.current;
        if (!instance) return;
        instance.goToAndStop(Math.max(instance.getDuration(true) - 1, 0), true);
      }}
      className={cn("size-[5.5rem] shrink-0", className)}
    />
  );
}
