"use client";

import { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

import { cn } from "@/lib/utils";

type KycJsonLottieProps = {
  src: string;
  loop?: boolean;
  className?: string;
};

export function KycJsonLottie({ src, loop = true, className }: KycJsonLottieProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(src)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setAnimationData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!animationData) {
    return (
      <div
        className={cn("mx-auto size-36 animate-pulse rounded-full bg-muted/40", className)}
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
      className={cn("mx-auto size-36 max-w-[11rem]", className)}
    />
  );
}
