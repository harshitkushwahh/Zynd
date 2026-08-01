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
    <div className="distributor-panel-card distributor-settings-content-card">
      <div className="distributor-panel-card__header distributor-settings-content-card__header">
        <div className="distributor-panel-card__header-row distributor-settings-content-card__header-row">
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-body font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="distributor-panel-card__description">{description}</p>
            ) : null}
          </div>
          {headerAside ? (
            <div className="distributor-settings-content-card__header-aside shrink-0">
              {headerAside}
            </div>
          ) : null}
        </div>
      </div>
      <div className="distributor-panel-card__body distributor-settings-content-card__body">
        {children}
      </div>
    </div>
  );
}
