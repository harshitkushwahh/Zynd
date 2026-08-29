import { resolveAmcLogoUrl } from "@/lib/distributor-asset-url";
import { cn } from "@/lib/utils";

export function schemeLogoMark(schemeName: string, amcName?: string | null): string {
  const source = (amcName ?? schemeName).trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "MF";
}

type DistributorSchemeWithLogoProps = {
  schemeName: string;
  amcLogoUrl?: string | null;
  amcSlug?: string | null;
  amcName?: string | null;
  compact?: boolean;
  className?: string;
};

export function DistributorSchemeWithLogo({
  schemeName,
  amcLogoUrl,
  amcSlug,
  amcName,
  compact = true,
  className,
}: DistributorSchemeWithLogoProps) {
  const logoUrl = resolveAmcLogoUrl(amcLogoUrl, amcSlug);
  const mark = schemeLogoMark(schemeName, amcName);
  const sizeClass = compact ? "size-8" : "size-10";

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain p-0.5",
            sizeClass,
          )}
        />
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted font-semibold text-muted-foreground",
            compact ? "text-[10px]" : "text-micro",
            sizeClass,
          )}
          aria-hidden
        >
          {mark}
        </div>
      )}
      <span
        className={cn(
          "min-w-0 font-medium leading-snug text-foreground",
          compact ? "text-caption" : "text-compact",
        )}
        title={schemeName}
      >
        {schemeName}
      </span>
    </div>
  );
}
