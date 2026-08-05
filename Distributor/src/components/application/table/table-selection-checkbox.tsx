"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox, type CheckboxProps } from "react-aria-components";

import { cn } from "@/lib/utils";

export function TableSelectionCheckbox({ className, ...props }: CheckboxProps) {
  return (
    <Checkbox
      slot="selection"
      className={cn(
        "group/table-checkbox flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border bg-background text-primary-foreground shadow-none transition-colors",
        "data-selected:border-primary data-selected:bg-primary",
        "data-indeterminate:border-primary data-indeterminate:bg-primary",
        "data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring/40",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {({ isSelected, isIndeterminate }) => (
        <>
          {isIndeterminate ? (
            <Minus className="size-3 stroke-[3]" aria-hidden />
          ) : isSelected ? (
            <Check className="size-3 stroke-[3]" aria-hidden />
          ) : null}
        </>
      )}
    </Checkbox>
  );
}
