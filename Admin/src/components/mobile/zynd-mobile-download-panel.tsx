"use client";

import { ArrowUpRight } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { BrandedQrCode } from "@/components/mobile/branded-qr-code";
import {
  AndroidStoreLogo,
  AppleStoreLogo,
} from "@/components/mobile/mobile-store-logos";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";
import { env } from "@/lib/env";

const zyndMobileRoute = ADMIN_NAV_ROUTES.find((route) => route.id === "zynd-mobile");

type PlatformDownloadCardProps = {
  platform: "Android" | "iOS";
  storeLabel: string;
  storeUrl: string;
  logo: React.ReactNode;
  steps: readonly string[];
};

function PlatformDownloadCard({
  platform,
  storeLabel,
  storeUrl,
  logo,
  steps,
}: PlatformDownloadCardProps) {
  return (
    <article className="flex flex-col rounded-xl border border-border/80 bg-card p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          {logo}
        </div>
        <div>
          <h2 className="font-heading text-compact font-semibold text-foreground">{platform}</h2>
          <p className="text-caption text-muted-foreground">{storeLabel}</p>
        </div>
      </div>

      <div className="mt-4 flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/20 p-5">
        <BrandedQrCode
          value={storeUrl}
          size={158}
          alt={`${platform} download QR code`}
        />
        <p className="mt-2.5 text-center text-caption text-muted-foreground">
          Scan to open the {storeLabel} listing
        </p>
      </div>

      <div className="mt-4">
        <p className="text-caption font-medium text-foreground">How to download</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-caption leading-snug text-muted-foreground">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <Button asChild className="mt-4 w-fit" size="sm">
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5"
        >
          View on {storeLabel}
          <ArrowUpRight className="size-4" />
        </a>
      </Button>
    </article>
  );
}

const ANDROID_STEPS = [
  "Scan the QR code with your phone camera.",
  "Open Google Play and tap Install.",
  "Sign in with your Zynd account.",
] as const;

const IOS_STEPS = [
  "Scan the QR code with your iPhone camera.",
  "Open the App Store and tap Get.",
  "Sign in with your Zynd account.",
] as const;

export function ZyndMobileDownloadPanel() {
  const title = zyndMobileRoute?.label ?? "Zynd Mobile";

  return (
    <div className="[&_.admin-page-header]:mb-3">
      <AdminSectionPageShell
        breadcrumbSegments={[{ label: title }]}
        title={title}
        icon={zyndMobileRoute?.icon}
      >
        <div className="grid gap-4 lg:grid-cols-2">
        <PlatformDownloadCard
          platform="Android"
          storeLabel="Google Play"
          storeUrl={env.zyndAndroidUrl}
          logo={<AndroidStoreLogo />}
          steps={ANDROID_STEPS}
        />
        <PlatformDownloadCard
          platform="iOS"
          storeLabel="App Store"
          storeUrl={env.zyndIosUrl}
          logo={<AppleStoreLogo className="text-foreground" />}
          steps={IOS_STEPS}
        />
      </div>
      </AdminSectionPageShell>
    </div>
  );
}
