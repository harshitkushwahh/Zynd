"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Info, Trash2 } from "lucide-react";

import { ADMIN_DIALOG_BODY_CLASS } from "@/components/ui/admin-dialog-styles";
import {
  ADMIN_DIALOG_BODY_SCROLL_CLASS,
  ADMIN_DIALOG_DETAIL_BODY_SCROLL_CLASS,
  ADMIN_DIALOG_MAX_HEIGHT_CLASS,
} from "@/components/ui/admin-design-tokens";
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
  resolveOpenChange,
  type AdminDialogIconTone,
  type AdminDialogSize,
} from "@/components/ui/admin-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogOpenProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
};

function useDialogHandlers({ open, onOpenChange, onClose }: DialogOpenProps) {
  return {
    open,
    onOpenChange: (next: boolean) => resolveOpenChange(next, onOpenChange, onClose),
  };
}

export function AdminDialogFooterActions({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  loading = false,
  confirmDisabled = false,
  confirmVariant = "default",
  confirmIcon: ConfirmIcon,
  showCancel = true,
  loadingLabel,
  className,
}: {
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  loading?: boolean;
  confirmDisabled?: boolean;
  confirmVariant?: "default" | "destructive";
  confirmIcon?: LucideIcon;
  showCancel?: boolean;
  loadingLabel?: string;
  className?: string;
}) {
  return (
    <>
      {showCancel ? (
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button
        variant={confirmVariant === "destructive" ? "destructive" : "default"}
        disabled={loading || confirmDisabled}
        onClick={onConfirm}
        className={className}
      >
        {ConfirmIcon ? <ConfirmIcon className="size-3.5" /> : null}
        {loading ? loadingLabel ?? "Working…" : confirmLabel}
      </Button>
    </>
  );
}

export function AdminInfoDialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  details,
  children,
  icon: Icon = Info,
  iconTone = "info",
  size = "sm",
  showCloseButton = true,
  footer,
  bodyClassName,
}: DialogOpenProps & {
  title: string;
  description?: string;
  details?: string[];
  children?: React.ReactNode;
  icon?: LucideIcon;
  iconTone?: AdminDialogIconTone;
  size?: AdminDialogSize;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  bodyClassName?: string;
}) {
  const dialog = useDialogHandlers({ open, onOpenChange, onClose });
  const hasBody = Boolean(children) || Boolean(details?.length);

  return (
    <AdminDialog {...dialog}>
      <AdminDialogContent size={size}>
        <AdminDialogHeader
          title={title}
          description={description}
          icon={Icon}
          iconTone={iconTone}
          showCloseButton={showCloseButton}
        />
        {hasBody ? (
          <AdminDialogBody className={cn(details?.length ? "space-y-3 pt-0" : "pt-0", bodyClassName)}>
            {children}
            {details?.map((detail) => (
              <p key={detail} className={ADMIN_DIALOG_BODY_CLASS}>
                {detail}
              </p>
            ))}
          </AdminDialogBody>
        ) : null}
        {footer ? <AdminDialogFooter>{footer}</AdminDialogFooter> : null}
      </AdminDialogContent>
    </AdminDialog>
  );
}

export function AdminConfirmDialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  confirmDisabled = false,
  onConfirm,
  icon = AlertTriangle,
  iconTone = "warning",
  confirmVariant = "default",
  size = "sm",
}: DialogOpenProps & {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  icon?: LucideIcon;
  iconTone?: AdminDialogIconTone;
  confirmVariant?: "default" | "destructive";
  size?: AdminDialogSize;
}) {
  const dialog = useDialogHandlers({ open, onOpenChange, onClose });

  return (
    <AdminDialog {...dialog}>
      <AdminDialogContent size={size}>
        <AdminDialogHeader
          title={title}
          description={description}
          icon={icon}
          iconTone={confirmVariant === "destructive" ? "destructive" : iconTone}
        />
        <AdminDialogFooter>
          <AdminDialogFooterActions
            cancelLabel={cancelLabel}
            confirmLabel={confirmLabel}
            loading={loading}
            confirmDisabled={confirmDisabled}
            confirmVariant={confirmVariant}
            onCancel={() => dialog.onOpenChange(false)}
            onConfirm={onConfirm}
          />
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
}

export function AdminDeleteDialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  itemLabel,
  size = "sm",
}: DialogOpenProps & {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  itemLabel?: string;
  size?: AdminDialogSize;
}) {
  const dialog = useDialogHandlers({ open, onOpenChange, onClose });

  return (
    <AdminDialog {...dialog}>
      <AdminDialogContent size={size}>
        <AdminDialogHeader
          title={title}
          description={description}
          icon={Trash2}
          iconTone="destructive"
        />
        {itemLabel ? (
          <AdminDialogBody className="pt-0">
            <p className="rounded-control border border-border bg-muted/20 px-3 py-2 text-compact font-medium text-foreground">
              {itemLabel}
            </p>
          </AdminDialogBody>
        ) : null}
        <AdminDialogFooter>
          <AdminDialogFooterActions
            cancelLabel={cancelLabel}
            confirmLabel={confirmLabel}
            loading={loading}
            loadingLabel="Deleting…"
            confirmVariant="destructive"
            onCancel={() => dialog.onOpenChange(false)}
            onConfirm={onConfirm}
          />
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
}

export function AdminFormDialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  icon,
  iconTone = "default",
  size = "md",
  children,
  footer,
  bodyClassName,
  headerAside,
  contentClassName,
}: DialogOpenProps & {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconTone?: AdminDialogIconTone;
  size?: AdminDialogSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  headerAside?: React.ReactNode;
  contentClassName?: string;
}) {
  const dialog = useDialogHandlers({ open, onOpenChange, onClose });

  return (
    <AdminDialog {...dialog}>
      <AdminDialogContent size={size} className={cn(ADMIN_DIALOG_MAX_HEIGHT_CLASS, contentClassName)}>
        <AdminDialogHeader
          title={title}
          description={description}
          icon={icon}
          iconTone={iconTone}
          headerAside={headerAside}
        />
        <AdminDialogBody className={cn(ADMIN_DIALOG_BODY_SCROLL_CLASS, bodyClassName)}>
          {children}
        </AdminDialogBody>
        {footer ? <AdminDialogFooter>{footer}</AdminDialogFooter> : null}
      </AdminDialogContent>
    </AdminDialog>
  );
}

/** Read-only or action-heavy detail view — no footer by default. */
export function AdminDetailDialog({
  size = "detail",
  bodyClassName = ADMIN_DIALOG_DETAIL_BODY_SCROLL_CLASS,
  ...props
}: Omit<React.ComponentProps<typeof AdminFormDialog>, "size" | "bodyClassName" | "footer"> & {
  size?: AdminDialogSize;
  bodyClassName?: string;
  footer?: React.ReactNode;
}) {
  return <AdminFormDialog size={size} bodyClassName={bodyClassName} {...props} />;
}

export function AdminInfoDialogTrigger({
  title,
  description,
  details,
  buttonClassName,
  icon: Icon = Info,
}: {
  title: string;
  description: string;
  details?: string[];
  buttonClassName?: string;
  icon?: LucideIcon;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("size-7 shrink-0 text-muted-foreground hover:text-foreground", buttonClassName)}
        aria-label={`About ${title}`}
        onClick={() => setOpen(true)}
      >
        <Icon className="size-3.5" />
      </Button>
      <AdminInfoDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        details={details}
        icon={Icon}
      />
    </>
  );
}
