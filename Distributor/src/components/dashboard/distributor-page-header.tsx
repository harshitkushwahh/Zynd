import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DistributorPageHeaderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
};

export function DistributorPageHeader({
  icon: Icon,
  title,
  description,
  children,
  className,
}: DistributorPageHeaderProps) {
  return (
    <header className={cn("distributor-page-header", className)}>
      <div className="distributor-page-header__lead">
        <span className="distributor-page-icon distributor-page-header__icon" aria-hidden>
          <Icon strokeWidth={2.25} />
        </span>
        <div className="distributor-page-header__copy">
          <h1 className="distributor-page-header__title">{title}</h1>
          {description ? (
            <p className="distributor-page-header__description">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? <div className="distributor-page-header__actions">{children}</div> : null}
    </header>
  );
}
