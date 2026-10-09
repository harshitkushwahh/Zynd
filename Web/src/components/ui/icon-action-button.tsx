"use client";

import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type IconActionButtonProps = {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  onClick: () => void;
};

export function IconActionButton({
  label,
  icon: Icon,
  disabled = false,
  loading = false,
  destructive = false,
  onClick,
}: IconActionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn("inline-flex", isDisabled && "cursor-not-allowed")}
            tabIndex={isDisabled ? 0 : undefined}
          />
        }
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn(
            "rounded-[var(--radius-control)]",
            destructive &&
              !isDisabled &&
              "text-destructive hover:bg-destructive/10 hover:text-destructive",
          )}
          disabled={isDisabled}
          onClick={onClick}
          aria-label={label}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Icon className="size-4" strokeWidth={2.25} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
