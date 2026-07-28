"use client";

import type { LucideIcon } from "lucide-react";

import {
  AdminDialog,
  AdminDialogContent,
  AdminDialogFooter,
  resolveOpenChange,
  type AdminDialogIconTone,
  type AdminDialogSize,
} from "@/components/ui/admin-dialog";
import { adminDialogIconClass } from "@/components/ui/admin-dialog-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminCenteredConfirmDialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title: string;
  description: string;
  icon: LucideIcon;
  iconTone?: AdminDialogIconTone;
  /** Primary action (e.g. Approve leave, Decline leave). */
  confirmLabel: string;
  /** Secondary action — defaults to Cancel. */
  cancelLabel?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void;
  size?: AdminDialogSize;
  className?: string;
};

export function AdminCenteredConfirmDialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  icon: Icon,
  iconTone = "warning",
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  confirmDisabled = false,
  confirmVariant = "default",
  onConfirm,
  size = "sm",
  className,
}: AdminCenteredConfirmDialogProps) {
  const handleOpenChange = (next: boolean) => resolveOpenChange(next, onOpenChange, onClose);

  return (
    <AdminDialog open={open} onOpenChange={handleOpenChange}>
      <AdminDialogContent size={size} className={className}>
        <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-full",
              adminDialogIconClass(iconTone),
            )}
            aria-hidden
          >
            <Icon className="size-7" strokeWidth={2} />
          </div>
          <h2 className="mt-5 font-heading text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-2 max-w-sm text-compact leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <AdminDialogFooter className="justify-center gap-2 border-t-0 pb-6 pt-4 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant === "destructive" ? "destructive" : "default"}
            disabled={loading || confirmDisabled}
            onClick={onConfirm}
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
}

type AdminCenteredDualActionDialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title: string;
  description: string;
  icon: LucideIcon;
  iconTone?: AdminDialogIconTone;
  approveLabel?: string;
  declineLabel?: string;
  loading?: boolean;
  onApprove: () => void;
  onDecline: () => void;
  size?: AdminDialogSize;
};

/** Centered icon + copy with Approve and Decline side by side (no separate confirm step). */
export function AdminCenteredDualActionDialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  icon: Icon,
  iconTone = "info",
  approveLabel = "Approve",
  declineLabel = "Decline",
  loading = false,
  onApprove,
  onDecline,
  size = "sm",
}: AdminCenteredDualActionDialogProps) {
  const handleOpenChange = (next: boolean) => resolveOpenChange(next, onOpenChange, onClose);

  return (
    <AdminDialog open={open} onOpenChange={handleOpenChange}>
      <AdminDialogContent size={size}>
        <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-full",
              adminDialogIconClass(iconTone),
            )}
            aria-hidden
          >
            <Icon className="size-7" strokeWidth={2} />
          </div>
          <h2 className="mt-5 font-heading text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-2 max-w-sm text-compact leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <AdminDialogFooter className="justify-center gap-2 border-t-0 pb-6 pt-4 sm:justify-center">
          <Button type="button" variant="outline" disabled={loading} onClick={onDecline}>
            {declineLabel}
          </Button>
          <Button type="button" disabled={loading} onClick={onApprove}>
            {loading ? "Working…" : approveLabel}
          </Button>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
}
