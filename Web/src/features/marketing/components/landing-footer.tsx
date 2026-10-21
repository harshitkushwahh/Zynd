import Link from "next/link";

import { landingAccentTextClass } from "@/features/marketing/lib/landing-accent";
import { LandingLogo } from "@/features/marketing/components/landing-logo";
import { APP_NAME } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type LandingFooterProps = {
  className?: string;
};

export function LandingFooter({ className }: LandingFooterProps) {
  const year = new Date().getFullYear();
  const { footer } = copy.marketing;

  return (
    <footer className={cn("landing-footer-root w-full", className)}>
      <div className="mx-auto w-full max-w-7xl px-6 pb-10 pt-12 sm:px-8 sm:pt-14">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <LandingLogo />
          <p className="mt-4 max-w-xs text-compact leading-relaxed text-muted-foreground">
            {footer.description}
          </p>
        </div>

        {footer.columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-compact font-semibold text-foreground">{column.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-compact text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center gap-6">
        <a
          href={`mailto:${footer.workContactEmail}`}
          className="landing-footer-contact-pill inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 rounded-full px-5 py-3 text-center text-compact font-medium transition-opacity hover:opacity-90"
        >
          <span className="text-slate-700 dark:text-white/85">{footer.workContactPrefix}</span>
          <span className={cn("underline-offset-2 hover:underline", landingAccentTextClass)}>
            {footer.workContactEmail}
          </span>
        </a>
        <p className="text-caption text-muted-foreground">
          {footer.copyright(year, APP_NAME)}
        </p>
      </div>
      </div>
    </footer>
  );
}
