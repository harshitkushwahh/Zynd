import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DistributorHttpErrorPage } from "@/components/errors/distributor-http-error-page";
import {
  getHttpErrorContent,
  normalizeHttpErrorCode,
} from "@/lib/distributor-http-error-catalog";

type HttpErrorRoutePageProps = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: HttpErrorRoutePageProps): Promise<Metadata> {
  const { code: rawCode } = await params;
  const code = normalizeHttpErrorCode(rawCode) ?? 500;
  const content = getHttpErrorContent(code);

  return {
    title: `${code} · ${content.title}`,
  };
}

export default async function HttpErrorRoutePage({ params }: HttpErrorRoutePageProps) {
  const { code: rawCode } = await params;
  const code = normalizeHttpErrorCode(rawCode);

  if (code === null) {
    notFound();
  }

  const homeHref = code === 401 ? "/" : "/dashboard";
  const homeLabel = code === 401 ? "Sign in" : "Go to dashboard";

  return (
    <DistributorHttpErrorPage
      code={code}
      homeHref={homeHref}
      homeLabel={homeLabel}
      showBack={false}
      layout="standalone"
    />
  );
}
