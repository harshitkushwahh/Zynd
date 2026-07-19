"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  ADMIN_DIALOG_BODY_CLASS,
  ADMIN_DIALOG_FOOTER_CLASS,
  ADMIN_DIALOG_HEADER_CLASS,
  ADMIN_DIALOG_OVERLAY_CLASS,
  type AdminDialogIconTone,
  type AdminDialogSize,
  adminDialogContentClass,
  adminDialogIconClass,
} from "@/components/ui/admin-dialog-styles";
import {
  ADMIN_DIALOG_DESCRIPTION_CLASS,
  ADMIN_DIALOG_TITLE_CLASS,
} from "@/components/dashboard/admin-typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminDialogRootProps = DialogPrimitive.Root.Props;

function AdminDialog(props: AdminDialogRootProps) {
  return <DialogPrimitive.Root data-slot="admin-dialog" {...props} />;
}

function AdminDialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="admin-dialog-trigger" {...props} />;
}

function AdminDialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="admin-dialog-portal" {...props} />;
}

function AdminDialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="admin-dialog-overlay"
      className={cn(ADMIN_DIALOG_OVERLAY_CLASS, className)}
      {...props}
    />
  );
}

function AdminDialogContent({
  size = "md",
  align = "center",
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props & {
  size?: AdminDialogSize;
  align?: "center" | "top";
}) {
  return (
    <AdminDialogPortal>
      <AdminDialogOverlay />
      <DialogPrimitive.Popup
        data-slot="admin-dialog-content"
        className={cn(
          adminDialogContentClass(size),
          align === "top" && "top-[12vh] -translate-y-0",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </AdminDialogPortal>
  );
}

function AdminDialogCloseButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <DialogPrimitive.Close
      data-slot="admin-dialog-close"
      render={
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8 shrink-0", className)}
          aria-label="Close"
          {...props}
        />
      }
    >
      <X className="size-4" />
    </DialogPrimitive.Close>
  );
}

function AdminDialogHeader({
  title,
  description,
  icon: Icon,
  iconTone = "default",
  showCloseButton = true,
  headerAside,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  iconTone?: AdminDialogIconTone;
  showCloseButton?: boolean;
  headerAside?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(ADMIN_DIALOG_HEADER_CLASS, className)}>
      {Icon ? (
        <div className={adminDialogIconClass(iconTone)} aria-hidden>
          <Icon className="size-5" strokeWidth={2} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <DialogPrimitive.Title className={ADMIN_DIALOG_TITLE_CLASS}>{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className={ADMIN_DIALOG_DESCRIPTION_CLASS}>
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
      </div>
      {headerAside ? <div className="flex shrink-0 items-center gap-2">{headerAside}</div> : null}
      {showCloseButton ? <AdminDialogCloseButton /> : null}
    </div>
  );
}

function AdminDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="admin-dialog-body" className={cn(ADMIN_DIALOG_BODY_CLASS, className)} {...props} />;
}

function AdminDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="admin-dialog-footer" className={cn(ADMIN_DIALOG_FOOTER_CLASS, className)} {...props} />
  );
}

function resolveOpenChange(
  open: boolean,
  onOpenChange?: (open: boolean) => void,
  onClose?: () => void,
) {
  onOpenChange?.(open);
  if (!open) onClose?.();
}

export {
  AdminDialog,
  AdminDialogTrigger,
  AdminDialogPortal,
  AdminDialogOverlay,
  AdminDialogContent,
  AdminDialogCloseButton,
  AdminDialogHeader,
  AdminDialogBody,
  AdminDialogFooter,
  resolveOpenChange,
};

export type { AdminDialogSize, AdminDialogIconTone };
