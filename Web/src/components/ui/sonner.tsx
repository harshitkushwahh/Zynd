"use client";

import type { CSSProperties } from "react";
import {
  Bell,
  CircleCheck,
  Info,
  Loader2,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/contexts/theme-context";

const toasterStyle = {
  "--width": "22rem",
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--normal-bg-hover": "color-mix(in srgb, var(--muted) 65%, var(--popover))",
  "--normal-border-hover": "color-mix(in srgb, var(--border) 70%, var(--foreground))",
  "--border-radius": "var(--radius-card)",
  "--success-bg": "color-mix(in srgb, var(--success) 12%, var(--popover))",
  "--success-border": "color-mix(in srgb, var(--success) 32%, var(--border))",
  "--success-text": "var(--success)",
  "--info-bg": "color-mix(in srgb, var(--info) 12%, var(--popover))",
  "--info-border": "color-mix(in srgb, var(--info) 32%, var(--border))",
  "--info-text": "var(--info)",
  "--warning-bg": "color-mix(in srgb, var(--warning) 14%, var(--popover))",
  "--warning-border": "color-mix(in srgb, var(--warning) 35%, var(--border))",
  "--warning-text": "var(--warning)",
  "--error-bg": "color-mix(in srgb, var(--destructive) 12%, var(--popover))",
  "--error-border": "color-mix(in srgb, var(--destructive) 32%, var(--border))",
  "--error-text": "var(--destructive)",
} as CSSProperties;

function Toaster({ ...props }: ToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="zynd-toaster"
      closeButton
      richColors
      icons={{
        success: <CircleCheck className="size-4 text-success" strokeWidth={2.25} />,
        info: <Info className="size-4 text-info" strokeWidth={2.25} />,
        warning: <TriangleAlert className="size-4 text-warning" strokeWidth={2.25} />,
        error: <OctagonX className="size-4 text-destructive" strokeWidth={2.25} />,
        loading: <Loader2 className="size-4 animate-spin text-primary" strokeWidth={2.25} />,
      }}
      style={toasterStyle}
      toastOptions={{
        classNames: {
          toast: "zynd-toast",
          title: "zynd-toast__title",
          description: "zynd-toast__description",
          actionButton: "zynd-toast__action",
          cancelButton: "zynd-toast__cancel",
          closeButton: "zynd-toast__close",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, Bell as ToastNotificationIcon };
