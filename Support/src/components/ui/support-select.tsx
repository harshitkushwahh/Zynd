"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Toolbar / filter trigger — modest radius (not pill). */
export const SUPPORT_SELECT_TRIGGER_CLASS = cn(
  "min-w-[9rem] rounded-md border-border bg-muted/45 px-3 shadow-none",
  "hover:bg-muted/65 dark:bg-input/30 dark:hover:bg-input/45",
  "data-[size=sm]:h-9 data-[size=sm]:rounded-md data-[size=sm]:py-0",
);

export const SUPPORT_SELECT_CONTENT_CLASS = "rounded-md";

export function SupportSelectTrigger({
  className,
  size = "sm",
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger size={size} className={cn(SUPPORT_SELECT_TRIGGER_CLASS, className)} {...props} />
  );
}

export {
  Select as SupportSelect,
  SelectContent as SupportSelectContent,
  SelectItem as SupportSelectItem,
  SelectValue as SupportSelectValue,
};
