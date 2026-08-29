"use client";

import { useEffect } from "react";

import { ClientDetailNotFoundView } from "@/components/clients/client-detail-not-found-view";
import { useDistributorPageChrome } from "@/components/dashboard/distributor-page-chrome-context";

export default function YourClientDetailNotFound() {
  const { setHideBreadcrumb } = useDistributorPageChrome();

  useEffect(() => {
    setHideBreadcrumb(true);
    return () => setHideBreadcrumb(false);
  }, [setHideBreadcrumb]);

  return <ClientDetailNotFoundView />;
}
