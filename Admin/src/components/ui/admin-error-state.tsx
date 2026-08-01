"use client";

import Image from "next/image";

import { AdminAuthButton } from "@/components/auth/admin-auth-button";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

type AdminErrorStateProps = {
  title?: string;
  message: string;
  digest?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function AdminErrorState({
  title = "Something went wrong",
  message,
  digest,
  actionLabel = "Try again",
  onAction,
  className,
}: AdminErrorStateProps) {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/zynda-h.png" : "/zynd-hl.png";

  return (
    <div className={cn("admin-error-shell", className)}>
      <div className="admin-error-card">
        <Image
          src={logoSrc}
          alt="ZYND"
          width={160}
          height={44}
          className="admin-error-card__logo"
          priority
        />

        <h1 className="admin-error-card__title">{title}</h1>

        <div className="admin-error-card__detail">
          <p className="admin-error-card__message">{message}</p>
          {digest ? <p className="admin-error-card__digest">Error ID: {digest}</p> : null}
        </div>

        {onAction ? (
          <AdminAuthButton type="button" className="admin-error-card__action" onClick={onAction}>
            {actionLabel}
          </AdminAuthButton>
        ) : null}
      </div>
    </div>
  );
}
