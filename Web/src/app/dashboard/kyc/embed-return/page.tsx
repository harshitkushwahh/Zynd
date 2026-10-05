"use client";

import { useEffect } from "react";

import { persistDigilockerReturnFromSearch } from "@/features/kyc/lib/kyc-digilocker-return";
import {
  buildKycDashboardPartnerReturnUrl,
  KYC_PARTNER_EMBED_RETURN_MESSAGE,
  KYC_PARTNER_RETURN_BROADCAST,
} from "@/features/kyc/lib/kyc-partner-embed";
import { clearKycPartnerPopupWindowName } from "@/features/kyc/lib/kyc-partner-popup";
import { copy } from "@/shared/config/copy";

/** Loaded in the partner popup when Finprim/Cybrilla redirects back to Zynd. */
export default function KycPartnerEmbedReturnPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const search = window.location.search;
    persistDigilockerReturnFromSearch(search);

    const payload = {
      type: KYC_PARTNER_EMBED_RETURN_MESSAGE,
      search,
      pathname: window.location.pathname,
    };
    const origin = window.location.origin;

    let openerAlive = false;
    try {
      openerAlive = Boolean(window.opener && !window.opener.closed);
      if (openerAlive && window.opener) {
        window.opener.postMessage(payload, origin);
      }
    } catch {
      openerAlive = false;
    }

    try {
      const channel = new BroadcastChannel(KYC_PARTNER_RETURN_BROADCAST);
      channel.postMessage(payload);
      channel.close();
    } catch {
      // BroadcastChannel unavailable — opener or full navigation must handle the return.
    }

    if (!openerAlive) {
      clearKycPartnerPopupWindowName();
      window.location.replace(buildKycDashboardPartnerReturnUrl(search, origin));
      return;
    }

    window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // Popup may not close if not script-opened.
      }
    }, 120);
  }, []);

  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 bg-background px-6 py-10 text-center">
      <p className="text-body font-medium text-foreground">{copy.kyc.partnerEmbed.finishingTitle}</p>
      <p className="text-caption text-muted-foreground">{copy.kyc.partnerEmbed.finishingDescription}</p>
    </div>
  );
}
