"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { resolveHttpErrorDisplay } from "@/lib/distributor-http-error-icons";
import { cn } from "@/lib/utils";

type DistributorHttpErrorPageProps = {
  code: number;
  title?: string;
  description?: string;
  detail?: string | null;
  referenceId?: string | null;
  homeHref?: string;
  homeLabel?: string;
  showBack?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  /** Center in the remaining viewport (dashboard shell). */
  layout?: "viewport" | "standalone" | "embedded";
  className?: string;
};

function parseReferenceId(detail?: string | null, referenceId?: string | null): string | null {
  if (referenceId?.trim()) {
    return referenceId.trim();
  }
  if (!detail?.trim()) {
    return null;
  }
  const match = detail.match(/^Reference:\s*(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function DistributorHttpErrorPage({
  code,
  title,
  description,
  detail,
  referenceId,
  homeHref = "/dashboard",
  homeLabel = "Go to dashboard",
  showBack = true,
  onRetry,
  retryLabel = "Try again",
  layout = "viewport",
  className,
}: DistributorHttpErrorPageProps) {
  const router = useRouter();
  const resolved = resolveHttpErrorDisplay(code);
  const Icon = resolved.icon;
  const resolvedTitle = title ?? resolved.title;
  const resolvedDescription = description ?? resolved.description;
  const resolvedReference = parseReferenceId(detail, referenceId);
  const extraDetail =
    detail?.trim() && !resolvedReference ? detail.trim() : null;

  return (
    <section
      role="alert"
      aria-live="polite"
      className={cn(
        "distributor-http-error-page",
        layout === "viewport" && "distributor-http-error-page--viewport",
        layout === "standalone" && "distributor-http-error-page--standalone",
        className,
      )}
    >
      <div className="distributor-http-error-page__panel">
        <div className="distributor-http-error-page__hero" aria-hidden>
          <span className="distributor-http-error-page__icon-ring">
            <Icon className="distributor-http-error-page__icon" strokeWidth={1.75} />
          </span>
        </div>

        <div className="distributor-http-error-page__content">
          <p className="distributor-http-error-page__eyebrow">Error {code}</p>
          <h1 className="distributor-http-error-page__title">{resolvedTitle}</h1>
          <p className="distributor-http-error-page__description">{resolvedDescription}</p>

          {resolvedReference ? (
            <div className="distributor-http-error-page__reference">
              <span className="distributor-http-error-page__reference-label">Reference</span>
              <code className="distributor-http-error-page__reference-value tabular-nums">
                {resolvedReference}
              </code>
            </div>
          ) : null}

          {extraDetail ? (
            <p className="distributor-http-error-page__detail">{extraDetail}</p>
          ) : null}
        </div>

        <div className="distributor-http-error-page__actions">
          {onRetry ? (
            <DistributorActionButton type="button" onClick={onRetry}>
              {retryLabel}
            </DistributorActionButton>
          ) : null}
          <DistributorActionButton
            type="button"
            variant={onRetry ? "outline" : "primary"}
            asChild
          >
            <Link href={homeHref}>{homeLabel}</Link>
          </DistributorActionButton>
          {showBack ? (
            <DistributorActionButton type="button" variant="outline" onClick={() => router.back()}>
              Go back
            </DistributorActionButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
