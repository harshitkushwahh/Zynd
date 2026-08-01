"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";

import { cn } from "@/lib/utils";

export const ADMIN_MENU_EASE = [0.22, 1, 0.36, 1] as const;

export const ADMIN_MENU_SURFACE_CLASS =
  "relative isolate z-50 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none";

export const ADMIN_MENU_ITEM_INTERACTION_CLASS =
  "focus:bg-muted focus:text-foreground hover:bg-muted data-highlighted:bg-muted data-highlighted:text-foreground";

export const ADMIN_MENU_ITEM_BASE_CLASS = cn(
  "relative flex cursor-default items-center gap-1.5 rounded-md text-sm outline-hidden select-none text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
  ADMIN_MENU_ITEM_INTERACTION_CLASS,
);

type PopupDomProps = React.ComponentPropsWithoutRef<"div"> & {
  "data-open"?: "";
  "data-closed"?: "";
  "data-starting-style"?: "";
  "data-ending-style"?: "";
};

export const AdminAnimatedPopup = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function AdminAnimatedPopup({ className, style, ...props }, ref) {
    const popupProps = props as PopupDomProps;
    const isOpen = popupProps["data-open"] !== undefined;
    const isEnding = popupProps["data-ending-style"] !== undefined;
    const visible = isOpen && !isEnding;

    return (
      <motion.div
        ref={ref}
        {...props}
        style={style}
        className={cn(ADMIN_MENU_SURFACE_CLASS, className)}
        initial={{ opacity: 0, scale: 0.97, y: -6 }}
        animate={
          visible
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.97, y: -4 }
        }
        transition={{ duration: 0.18, ease: ADMIN_MENU_EASE }}
      />
    );
  },
);
