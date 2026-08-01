import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DistributorPageHeaderProps = {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  titleClassName?: string;
  titleAs?: "h1" | "h2" | "h3";
  /** When set, re-mounts the title for a short enter animation (e.g. scope tabs). */
  titleSwitchKey?: string;
};

export function DistributorPageHeader({
  title,
  description = "",
  children,
  className,
  titleClassName,
  titleAs: TitleTag = "h1",
  titleSwitchKey,
}: DistributorPageHeaderProps) {
  return (
    <header className={cn("distributor-page-header", className)}>
      <div className="distributor-page-header__lead">
        <div className="distributor-page-header__copy">
          <TitleTag
            key={titleSwitchKey}
            className={cn(
              "distributor-page-header__title",
              titleSwitchKey && "distributor-page-header__title--scope-enter",
              titleClassName,
            )}
          >
            {title}
          </TitleTag>
          {description ? (
            <p className="distributor-page-header__description">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? <div className="distributor-page-header__actions">{children}</div> : null}
    </header>
  );
}
