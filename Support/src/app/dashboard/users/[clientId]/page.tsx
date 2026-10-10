"use client";

import { use } from "react";

import { SupportUserDetailPage } from "@/components/users/support-user-detail-page";

type SupportUserDetailRouteProps = {
  params: Promise<{ clientId: string }>;
};

export default function SupportUserDetailRoute({ params }: SupportUserDetailRouteProps) {
  const { clientId } = use(params);
  return <SupportUserDetailPage clientId={clientId} />;
}
