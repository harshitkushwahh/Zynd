"use client";

import { Suspense, use } from "react";

import { YourOperationsPage } from "@/components/workspace/your-operations-page";

type YourOperationsVariantPageProps = {
  params: Promise<{ section: string; variant: string }>;
};

function YourOperationsVariantPageInner({ section, variant }: { section: string; variant: string }) {
  return <YourOperationsPage sectionSlug={section} variantSlug={variant} />;
}

export default function YourOperationsVariantPage({ params }: YourOperationsVariantPageProps) {
  const { section, variant } = use(params);
  return (
    <Suspense fallback={null}>
      <YourOperationsVariantPageInner section={section} variant={variant} />
    </Suspense>
  );
}
