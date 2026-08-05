"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

type GoalTemplateIllustrationImageProps = {
  src: string;
  /** Dialog hero — load immediately when the journey opens. */
  priority?: boolean;
  className?: string;
  wrapperClassName?: string;
};

const DIALOG_IMAGE_SIZES = "(max-width: 768px) 100vw, 420px";

export function GoalTemplateIllustrationImage({
  src,
  priority = false,
  className,
  wrapperClassName,
}: GoalTemplateIllustrationImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn("relative size-full", wrapperClassName)}>
      {!loaded ? (
        <div
          className="absolute inset-0 animate-pulse bg-muted/80"
          aria-hidden
        />
      ) : null}
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        sizes={DIALOG_IMAGE_SIZES}
        className={cn(
          "object-cover object-center transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

type GoalTemplateIllustrationThumbProps = {
  src: string;
  className?: string;
};

const THUMB_SIZE = 44;

/** Small template card thumbnail (fixed 44×44). */
export function GoalTemplateIllustrationThumb({ src, className }: GoalTemplateIllustrationThumbProps) {
  return (
    <Image
      src={src}
      alt=""
      width={THUMB_SIZE}
      height={THUMB_SIZE}
      sizes={`${THUMB_SIZE}px`}
      className={cn("size-full object-cover", className)}
    />
  );
}
