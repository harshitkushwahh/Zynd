"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type KycDialogCloseButtonProps = {
  onClose: () => void;
  className?: string;
};

export function KycDialogCloseButton({ onClose, className }: KycDialogCloseButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClose}
      aria-label="Close"
      className={cn(
        "absolute top-4 right-4 z-30 text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        className,
      )}
    >
      <XIcon className="size-4" />
    </Button>
  );
}
