"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ClientDetailNotFoundView } from "@/components/clients/client-detail-not-found-view";
import { useDistributorPageChrome } from "@/components/dashboard/distributor-page-chrome-context";
import { distributorClientListHref } from "@/lib/distributor-client-routes";

export default function YourClientDetailNotFound() {
  const pathname = usePathname();
  const { setHideBreadcrumb } = useDistributorPageChrome();
  const listOrigin = pathname.startsWith("/dashboard/investors/resident")
    ? "system-resident"
    : "your-book";

  useEffect(() => {
    setHideBreadcrumb(true);
    return () => setHideBreadcrumb(false);
  }, [setHideBreadcrumb]);

  return <ClientDetailNotFoundView backHref={distributorClientListHref(listOrigin)} />;
}
