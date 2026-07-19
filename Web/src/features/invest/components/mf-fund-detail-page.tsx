"use client";

import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MfFundDetailView } from "@/features/invest/components/mf-fund-detail-view";

type MfFundDetailPageProps = {
  fundSlug: string;
};

export function MfFundDetailPage({ fundSlug }: MfFundDetailPageProps) {
  return (
    <MfFundDetailView
      fundSlug={fundSlug}
      renderBreadcrumb={(fundName) => (
        <MfBreadcrumb
          trail={[
            {
              label: fundName ?? "Fund details",
            },
          ]}
        />
      )}
    />
  );
}
