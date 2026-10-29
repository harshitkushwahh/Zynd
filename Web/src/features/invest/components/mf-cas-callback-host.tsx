"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { copy } from "@/shared/config/copy";

export function MfCasCallbackHost() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const payload = {
      type: "mfc-cas-complete",
      data: {
        status: params.get("status") ?? "",
        reqId: params.get("reqId") ?? "",
        type: params.get("type") ?? "",
        code: params.get("code") ?? "",
        message: params.get("message") ?? "",
      },
    };
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }
    router.replace("/dashboard/mutual-funds");
  }, [params, router]);

  return <p className="text-compact text-muted-foreground">{copy.mutualFunds.casWaiting}</p>;
}
