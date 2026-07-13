"use client";

import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MfFundDetailView } from "@/features/invest/components/mf-fund-detail-view";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";

type MfFundDetailPageProps = {
  productId: string;
};

export function MfFundDetailPage({ productId }: MfFundDetailPageProps) {
  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfFundDetailView
        productId={productId}
        renderBreadcrumb={(fundName) => (
          <MfBreadcrumb
            trail={[
              {
                label: fundName ?? "Fund details",
              },
            ]}
          />
        )}
        onOrderPlaced={() => {}}
      />
    </div>
  );
}
