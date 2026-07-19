"use client";

import { use } from "react";

import { TxnRequestsSectionPage } from "@/components/mf/txn-requests-section-page";

type TxnRequestsPageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function TxnRequestsPage({ params }: TxnRequestsPageProps) {
  const { tab } = use(params);
  return <TxnRequestsSectionPage tabSlug={tab?.[0]} />;
}
