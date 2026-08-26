"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 backdrop-zynd-overlay duration-300 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeTone = "default",
  overlayClassName,
  centeredLayout = false,
  motion = "default",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  closeTone?: "default" | "on-brand";
  overlayClassName?: string;
  centeredLayout?: boolean;
  motion?: "default" | "fade";
}) {
  const popupMotionClass =
    motion === "fade"
      ? "duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150"
      : "duration-300 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

  const popupClassName = cn(
    centeredLayout
      ? "relative z-50 grid w-full max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[var(--radius-modal)] bg-popover p-0 text-popover-foreground shadow-zynd-high ring-1 ring-border outline-none"
      : "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-[var(--radius-modal)] bg-popover p-0 text-popover-foreground shadow-zynd-high ring-1 ring-border outline-none",
    popupMotionClass,
    className,
  );

  if (centeredLayout) {
    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Popup
            data-slot="dialog-content"
            className={cn("pointer-events-auto", popupClassName)}
            {...props}
          >
            {children}
            {showCloseButton ? (
              <DialogPrimitive.Close
                data-slot="dialog-close"
                render={
                  <Button
                    variant="ghost"
                    className={cn(
                      "absolute top-3 right-3 z-10 rounded-[var(--radius-control)]",
                      closeTone === "on-brand"
                        ? "text-primary-foreground hover:bg-transparent hover:text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    size="icon-sm"
                  />
                }
              >
                <XIcon
                  className={cn(
                    closeTone === "on-brand" ? "text-primary-foreground" : "text-current"
                  )}
                />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            ) : null}
          </DialogPrimitive.Popup>
        </div>
      </DialogPortal>
    );
  }

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={popupClassName}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className={cn(
                  "absolute top-3 right-3 z-10 rounded-[var(--radius-control)]",
                  closeTone === "on-brand"
                    ? "text-primary-foreground hover:bg-transparent hover:text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                size="icon-sm"
              />
            }
          >
            <XIcon
              className={cn(
                closeTone === "on-brand" ? "text-primary-foreground" : "text-current"
              )}
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t border-border/60 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
