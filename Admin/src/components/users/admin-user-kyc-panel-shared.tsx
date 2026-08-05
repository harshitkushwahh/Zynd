"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";
import { cn } from "@/lib/utils";

export function formatKycLabel(value: string | null | undefined) {
  if (!value) return null;
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function KycPanelShell({
  title,
  icon: Icon,
  children,
  className,
  headerExtra,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
}) {
  return (
    <section className={cn("admin-user-kyc-identity-panel", className)}>
      <header className="admin-user-kyc-identity-panel__header">
        <div className="admin-user-kyc-identity-panel__header-main">
          <div className="admin-user-kyc-identity-panel__header-icon" aria-hidden>
            <Icon className="size-4" strokeWidth={2.25} />
          </div>
          <h4 className={cn(PROFILE_SECTION_TITLE_CLASS, "admin-user-kyc-identity-panel__title")}>
            {title}
          </h4>
        </div>
        {headerExtra}
      </header>
      <div className="admin-user-kyc-identity-panel__body">{children}</div>
    </section>
  );
}

export function KycPanelEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="admin-user-kyc-identity-empty">
      <div className="admin-user-kyc-identity-empty__icon" aria-hidden>
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <p className="admin-user-kyc-identity-empty__title">{title}</p>
      <p className="admin-user-kyc-identity-empty__description">{description}</p>
    </div>
  );
}

export function KycField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className={cn("admin-user-kyc-identity-field", className)}>
      <dt className="admin-user-kyc-identity-field__label">{label}</dt>
      <dd className="admin-user-kyc-identity-field__value">{value}</dd>
    </div>
  );
}

export function KycFieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="admin-user-kyc-identity-field-grid">{children}</dl>;
}

export function KycPanelCarouselNav({
  activeIndex,
  total,
  onPrevious,
  onNext,
  label,
}: {
  activeIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  label: string;
}) {
  if (total <= 1) return null;

  return (
    <div className="admin-user-kyc-carousel-nav" aria-label={`${label} navigation`}>
      <button
        type="button"
        className="admin-user-kyc-carousel-nav__button"
        onClick={onPrevious}
        aria-label={`Previous ${label}`}
      >
        <ChevronLeft className="size-4" strokeWidth={2.25} aria-hidden />
      </button>
      <span className="admin-user-kyc-carousel-nav__counter">
        {activeIndex + 1} / {total}
      </span>
      <button
        type="button"
        className="admin-user-kyc-carousel-nav__button"
        onClick={onNext}
        aria-label={`Next ${label}`}
      >
        <ChevronRight className="size-4" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
