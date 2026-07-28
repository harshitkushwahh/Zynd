import type { ReactNode } from "react";

type DistributorSettingsContentCardProps = {
  title: string;
  description?: string;
  headerAside?: ReactNode;
  children: ReactNode;
};

export function DistributorSettingsContentCard({
  title,
  description,
  headerAside,
  children,
}: DistributorSettingsContentCardProps) {
  return (
    <div className="distributor-panel-card">
      <div className="distributor-panel-card__header">
        <div className="distributor-panel-card__header-row">
          <div className="min-w-0">
            <h2 className="font-heading text-body font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="distributor-panel-card__description">{description}</p>
            ) : null}
          </div>
          {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
        </div>
      </div>
      <div className="distributor-panel-card__body">{children}</div>
    </div>
  );
}
