"use client";

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { applyDistributorDocumentTitle } from "@/lib/distributor-document-title";

function readWindowSearchParams() {
  return new URLSearchParams(window.location.search);
}

/** Updates the tab title as soon as the route path changes — no Suspense wait. */
export function DistributorDocumentTitlePathSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    applyDistributorDocumentTitle(pathname, readWindowSearchParams());
  }, [pathname]);

  return null;
}

/** Keeps query-driven titles (clientsScope, ordersScope, tabs) in sync. */
export function DistributorDocumentTitleSearchSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useLayoutEffect(() => {
    applyDistributorDocumentTitle(pathname, searchParams);
  }, [pathname, searchKey, searchParams]);

  return null;
}
