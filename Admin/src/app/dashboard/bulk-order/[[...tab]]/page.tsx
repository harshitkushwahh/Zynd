"use client";

import { use } from "react";

import { BulkOrderSectionPage } from "@/components/mf/bulk-order-section-page";

type BulkOrderPageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function BulkOrderPage({ params }: BulkOrderPageProps) {
  const { tab } = use(params);
  return <BulkOrderSectionPage tabSlug={tab?.[0]} />;
}
