"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Pill filter / option trigger — full radius, slightly taller than default `sm`. */
export const DISTRIBUTOR_OPTION_BOX_TRIGGER_CLASS = cn(
  "min-w-[9rem] rounded-full border-border bg-muted/45 px-4 shadow-none",
  "hover:bg-muted/65 dark:bg-input/30 dark:hover:bg-input/45",
  "data-[size=sm]:h-9 data-[size=sm]:rounded-full data-[size=sm]:py-0",
)

export function DistributorOptionBoxTrigger({
  className,
  size = "sm",
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      size={size}
      className={cn(DISTRIBUTOR_OPTION_BOX_TRIGGER_CLASS, className)}
      {...props}
    />
  )
}

export {
  Select as DistributorOptionBox,
  SelectContent as DistributorOptionBoxContent,
  SelectItem as DistributorOptionBoxItem,
  SelectValue as DistributorOptionBoxValue,
}
