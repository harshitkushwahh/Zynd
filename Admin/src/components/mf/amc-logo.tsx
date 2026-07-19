"use client";

import Image from "next/image";
import { Building2 } from "lucide-react";

import { resolveAdminAssetUrl } from "@/lib/mf-admin-asset-url";
import { cn } from "@/lib/utils";

type AmcLogoProps = {
  name?: string | null;
  logoUrl?: string | null;
  size?: "sm" | "md";
  fallback?: "initials" | "icon";
  className?: string;
};

export function AmcLogo({
  name,
  logoUrl,
  size = "sm",
  fallback = "initials",
  className,
}: AmcLogoProps) {
  const resolvedUrl = resolveAdminAssetUrl(logoUrl);
  const dimension = size === "sm" ? "size-8" : "size-10";
  const imageSize = size === "sm" ? 32 : 40;
  const label = name?.trim() || "Fund";
  const initials = label.slice(0, 2).toUpperCase() || "AM";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-border bg-background",
        dimension,
        className,
      )}
    >
      {resolvedUrl ? (
        <Image
          src={resolvedUrl}
          alt={`${label} logo`}
          width={imageSize}
          height={imageSize}
          className="size-full object-contain p-1"
          unoptimized
        />
      ) : fallback === "icon" ? (
        <Building2 className="size-4 text-muted-foreground" />
      ) : (
        <span className="text-micro font-semibold text-muted-foreground">{initials}</span>
      )}
    </div>
  );
}
