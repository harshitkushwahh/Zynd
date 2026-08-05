"use client";

import { Suspense } from "react";

import {
  DistributorDocumentTitlePathSync,
  DistributorDocumentTitleSearchSync,
} from "@/hooks/use-distributor-document-title";

/** Keeps the browser tab title in sync with the active dashboard route. */
export function DistributorDocumentTitleSync() {
  return (
    <>
      <DistributorDocumentTitlePathSync />
      <Suspense fallback={null}>
        <DistributorDocumentTitleSearchSync />
      </Suspense>
    </>
  );
}
