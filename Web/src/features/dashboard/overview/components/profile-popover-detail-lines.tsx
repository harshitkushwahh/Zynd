"use client";

import { cn } from "@/lib/utils";

type ProfilePopoverDetailLinesProps = {
  lines: readonly string[];
  className?: string;
};

export function ProfilePopoverDetailLines({ lines, className }: ProfilePopoverDetailLinesProps) {
  return (
    <div className={cn("mt-1.5 w-full max-w-[11.5rem] space-y-0.5 text-center", className)}>
      {lines.map((line, index) => (
        <p key={index} className="text-[11px] leading-snug text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}
