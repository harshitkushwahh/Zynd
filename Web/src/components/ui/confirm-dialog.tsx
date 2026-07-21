"use client";

import type { LucideIcon } from "lucide-react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type ConfirmDialogVariant = "info" | "warning" | "destructive";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: ConfirmDialogVariant;
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  doneLabel?: string;
  onConfirm?: () => void;
  loading?: boolean;
};

const variantConfig: Record<
  ConfirmDialogVariant,
  { icon: LucideIcon; iconClassName: string }
> = {
  info: {
    icon: Info,
    iconClassName: "bg-info/10 text-info",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "bg-warning/10 text-warning",
  },
  destructive: {
    icon: AlertCircle,
    iconClassName: "bg-destructive/10 text-destructive",
  },
};

function ConfirmDialogIcon({ variant }: { variant: ConfirmDialogVariant }) {
  const { icon: Icon, iconClassName } = variantConfig[variant];

  return (
    <div
      className={cn(
        "flex size-14 items-center justify-center rounded-full",
        iconClassName
      )}
    >
      <Icon className="size-6" strokeWidth={2.25} />
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  variant,
  title,
  description,
  confirmLabel = copy.confirmDialog.confirm,
  cancelLabel = copy.confirmDialog.cancel,
  doneLabel = copy.confirmDialog.done,
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const isInfo = variant === "info";

  const handleDone = () => {
    onConfirm?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[60] max-w-sm gap-0 overflow-hidden p-0"
        overlayClassName="z-[60]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{title ?? description}</DialogTitle>

        <div className="flex flex-col items-center px-6 py-6 text-center">
          <ConfirmDialogIcon variant={variant} />

          {!isInfo && title ? (
            <h3 className="mt-4 text-h4 font-semibold text-foreground">{title}</h3>
          ) : null}

          {isInfo && title ? (
            <h3 className="mt-4 text-body font-semibold text-foreground">{title}</h3>
          ) : null}

          <p
            className={cn(
              "max-w-sm text-caption leading-relaxed text-muted-foreground",
              isInfo ? (title ? "mt-2" : "mt-4") : "mt-2"
            )}
          >
            {description}
          </p>

          <div className={cn("mt-6 flex w-full gap-2", isInfo ? "justify-center" : "flex-col-reverse sm:flex-row sm:justify-center")}>
            {isInfo ? (
              <Button type="button" className="min-w-[7rem]" onClick={handleDone} disabled={loading}>
                {doneLabel}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-[7rem]"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant={variant === "destructive" ? "destructive" : "default"}
                  className="sm:min-w-[7rem]"
                  onClick={() => {
                    onConfirm?.();
                  }}
                  disabled={loading}
                >
                  {confirmLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
