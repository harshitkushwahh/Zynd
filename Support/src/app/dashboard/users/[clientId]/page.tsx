"use client";

import { use } from "react";

import { SupportUserDetailPage } from "@/components/users/support-user-detail-page";
import { decodeSupportClientReference } from "@/lib/support-users-api";

type SupportUserDetailRouteProps = {
  params: Promise<{ clientId: string }>;
};

export default function SupportUserDetailRoute({ params }: SupportUserDetailRouteProps) {
  const { clientId } = use(params);
  return <SupportUserDetailPage clientId={decodeSupportClientReference(clientId)} />;
}
