"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { LandingAuthActions } from "@/features/marketing/components/landing-auth-actions";
import { LandingLogo } from "@/features/marketing/components/landing-logo";
import { LandingThemeToggle } from "@/features/marketing/components/landing-theme-toggle";
import { MARKETING_NAV_ICON_BY_HREF } from "@/features/marketing/lib/nav-icons";
import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function navLinkActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function LandingNavLink({
  href,
  label,
  active,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const Icon = MARKETING_NAV_ICON_BY_HREF[href];

  return (
    <Link
      href={href}
      className={cn(
        "landing-nav-link inline-flex items-center gap-1.5",
        className,
      )}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {active && Icon ? <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden /> : null}
      {label}
    </Link>
  );
}

function NavbarInner({
  pathname,
  mobileOpen,
  onToggleMobile,
}: {
  pathname: string;
  mobileOpen: boolean;
  onToggleMobile: () => void;
}) {
  return (
    <div className="flex w-full min-h-[3.25rem] items-center justify-between gap-3 px-3 py-2 sm:gap-4 sm:px-5 sm:py-2.5">
      <LandingLogo priority />

      <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
        {copy.marketing.navLinks.map((item) => (
          <LandingNavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={navLinkActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <LandingThemeToggle />
        <LandingAuthActions />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full lg:hidden"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? copy.marketing.navCloseMenu : copy.marketing.navOpenMenu}
          onClick={onToggleMobile}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>
    </div>
  );
}

export function LandingNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="landing-navbar fixed inset-x-0 top-0 z-[60] px-4 py-3 sm:px-6 lg:px-8">
      <div className="landing-nav-glass-bar mx-auto max-w-7xl rounded-[1.75rem]">
        <NavbarInner
          pathname={pathname}
          mobileOpen={mobileOpen}
          onToggleMobile={() => setMobileOpen((open) => !open)}
        />
      </div>

      {mobileOpen ? (
        <div className="landing-nav-glass-bar mx-auto mt-3 max-w-7xl rounded-[var(--radius-card)] lg:hidden">
          <nav aria-label="Primary mobile" className="flex w-full flex-col gap-0.5 p-2">
            {copy.marketing.navLinks.map((item) => (
              <LandingNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={navLinkActive(pathname, item.href)}
                className="px-4 py-3"
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
