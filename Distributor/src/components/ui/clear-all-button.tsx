"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClearAllButtonProps = {
  onClear: () => void;
  disabled?: boolean;
  className?: string;
};

export function ClearAllButton({ onClear, disabled = false, className }: ClearAllButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onClear}
      className={cn("shrink-0", className)}
    >
      Clear all
    </Button>
  );
}
