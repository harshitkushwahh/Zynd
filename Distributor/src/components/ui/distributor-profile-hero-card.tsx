"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Check, Mail, Phone, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DistributorProfileHeroCardProps = {
  name: string;
  roleLabel: string;
  experienceLabel?: string;
  /** When set, replaces the default experience badge (e.g. client code + copy). */
  badge?: ReactNode;
  imageSrc?: string | null;
  /** Used when `imageSrc` is empty. Defaults to demo profile photo. */
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
  experienceLabel = "4+ years experience",
  badge,
  imageSrc,
  fallbackImageSrc = "/profile.jpeg",
  brandFallbackImage = false,
  email,
  phone,
  overlayTopEnd,
  overlayBottomStart,
  className,
}: DistributorProfileHeroCardProps) {
  const trimmedImage = imageSrc?.trim();
  const usingBrandFallback = !trimmedImage && brandFallbackImage;
  const resolvedImage = trimmedImage || fallbackImageSrc;
  const resolvedPhone = phone?.trim() || DEFAULT_PHONE;
  const resolvedEmail = email?.trim() || DEFAULT_EMAIL;

  return (
    <article className={cn("distributor-profile-hero-card", className)}>
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
      <div className="distributor-profile-hero-card__shade" aria-hidden />

      {overlayTopEnd ? (
        <div className="distributor-profile-hero-card__top-end">{overlayTopEnd}</div>
      ) : null}

      {overlayBottomStart ? (
        <div className="distributor-profile-hero-card__bottom-start">{overlayBottomStart}</div>
      ) : null}

      {badge ?? (
        <div className="distributor-profile-hero-card__badge">
          <span>{experienceLabel}</span>
          <Sparkles className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        </div>
      )}

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
