"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Check, Mail, Phone, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { getDisplayInitials } from "@/lib/get-display-initials";

export type DistributorProfileHeroCardProps = {
  name: string;
  roleLabel: string;
  experienceLabel?: string;
  /** When set, replaces the default experience badge (e.g. client code + copy). */
  badge?: ReactNode;
  imageSrc?: string | null;
  /** Used when `imageSrc` is empty. Omit to show initials on a gradient surface. */
  fallbackImageSrc?: string;
  /** When true, fallback uses logo containment styling instead of cover photo. */
  brandFallbackImage?: boolean;
  email?: string | null;
  phone?: string | null;
  /** Top-right overlay on the hero image (e.g. client status chips). */
  overlayTopEnd?: ReactNode;
  /** Bottom-left overlay on the hero image (e.g. sign-in providers). */
  overlayBottomStart?: ReactNode;
  className?: string;
};

const DEFAULT_PHONE = "+91 90000 00000";
const DEFAULT_EMAIL = "support@zynd.distributor";

function ProfileHeroCopyAction({
  name,
  value,
  kind,
  variant,
  icon: Icon,
}: {
  name: string;
  value: string;
  kind: "phone" | "email";
  variant: "light" | "dark";
  icon: LucideIcon;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  const ariaLabel = copied
    ? kind === "phone"
      ? "Phone number copied"
      : "Email copied"
    : kind === "phone"
      ? `Copy phone number for ${name}`
      : `Copy email for ${name}`;

  return (
    <button
      type="button"
      className={cn(
        "distributor-profile-hero-card__action",
        variant === "light" && "distributor-profile-hero-card__action--light",
        variant === "dark" && "distributor-profile-hero-card__action--dark",
      )}
      onClick={() => void onCopy()}
      aria-label={ariaLabel}
    >
      {copied ? (
        <Check className="size-4" strokeWidth={2.25} aria-hidden />
      ) : (
        <Icon className="size-4" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}

export function DistributorProfileHeroCard({
  name,
  roleLabel,
  experienceLabel,
  badge,
  imageSrc,
  fallbackImageSrc,
  brandFallbackImage = false,
  email,
  phone,
  overlayTopEnd,
  overlayBottomStart,
  className,
}: DistributorProfileHeroCardProps) {
  const trimmedImage = imageSrc?.trim();
  const trimmedFallback = fallbackImageSrc?.trim();
  const usingInitialsFallback = !trimmedImage && !trimmedFallback;
  const usingBrandFallback = !trimmedImage && Boolean(trimmedFallback) && brandFallbackImage;
  const resolvedImage = trimmedImage || trimmedFallback;
  const initials = getDisplayInitials(name);
  const resolvedPhone = phone?.trim() || DEFAULT_PHONE;
  const resolvedEmail = email?.trim() || DEFAULT_EMAIL;

  return (
    <article
      className={cn(
        "distributor-profile-hero-card",
        usingInitialsFallback && "distributor-profile-hero-card--initials",
        className,
      )}
    >
      {usingInitialsFallback ? (
        <div className="distributor-profile-hero-card__initials-fallback" aria-hidden>
          <span className="distributor-profile-hero-card__initials-mark">{initials}</span>
        </div>
      ) : resolvedImage ? (
        <Image
          src={resolvedImage}
          alt=""
          fill
          priority
          sizes="(max-width: 48rem) 100vw, 20rem"
          className={cn(
            "distributor-profile-hero-card__image",
            usingBrandFallback && "distributor-profile-hero-card__image--brand",
          )}
        />
      ) : null}
      <div className="distributor-profile-hero-card__shade" aria-hidden />

      {overlayTopEnd ? (
        <div className="distributor-profile-hero-card__top-end">{overlayTopEnd}</div>
      ) : null}

      {overlayBottomStart ? (
        <div className="distributor-profile-hero-card__bottom-start">{overlayBottomStart}</div>
      ) : null}

      {badge ??
        (experienceLabel ? (
          <div className="distributor-profile-hero-card__badge">
            <span>{experienceLabel}</span>
            <Sparkles className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          </div>
        ) : null)}

      <footer className="distributor-profile-hero-card__footer">
        <div className="distributor-profile-hero-card__footer-glass" aria-hidden />
        <div className="distributor-profile-hero-card__footer-inner">
          <div className="distributor-profile-hero-card__identity">
            <p className="distributor-profile-hero-card__name">{name}</p>
            <p className="distributor-profile-hero-card__role">{roleLabel}</p>
          </div>
          <div className="distributor-profile-hero-card__actions">
            <ProfileHeroCopyAction
              name={name}
              value={resolvedPhone}
              kind="phone"
              variant="light"
              icon={Phone}
            />
            <ProfileHeroCopyAction
              name={name}
              value={resolvedEmail}
              kind="email"
              variant="dark"
              icon={Mail}
            />
          </div>
        </div>
      </footer>
    </article>
  );
}
