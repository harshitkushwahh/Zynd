"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClearAllButtonProps = {
  onClear: () => void;
  disabled?: boolean;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
};

export function ClearAllButton({
  onClear,
  disabled = false,
  className,
  variant = "ghost",
  size = "sm",
}: ClearAllButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={onClear}
      className={cn("shrink-0", className)}
    >
      Clear all
    </Button>
  );
}
