"use client";

import { CircleHelp } from "lucide-react";

import { CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MfGrowthProjectionHeaderProps = {
  title: string;
  description: string;
  className?: string;
};

export function MfGrowthProjectionHeader({
  title,
  description,
  className,
}: MfGrowthProjectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <CardTitle className="min-w-0">{title}</CardTitle>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={description}
        >
          <CircleHelp className="size-4" strokeWidth={2.25} aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="max-w-[16rem] text-pretty">
          {description}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
