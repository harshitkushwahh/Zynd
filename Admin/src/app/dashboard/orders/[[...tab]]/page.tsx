"use client";

import { use } from "react";

import { OrdersSectionPage } from "@/components/mf/orders-section-page";

type OrdersPageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function OrdersPage({ params }: OrdersPageProps) {
  const { tab } = use(params);
  return <OrdersSectionPage tabSlug={tab?.[0]} />;
}
