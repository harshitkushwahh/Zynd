"use client";

import { use } from "react";

import { YourOperationsPage } from "@/components/workspace/your-operations-page";

type YourOperationsVariantPageProps = {
  params: Promise<{ section: string; variant: string }>;
};

export default function YourOperationsVariantPage({ params }: YourOperationsVariantPageProps) {
  const { section, variant } = use(params);
  return <YourOperationsPage sectionSlug={section} variantSlug={variant} />;
}
