import { Suspense } from "react";

import { MfCasCallbackHost } from "@/features/invest/components/mf-cas-callback-host";

export const metadata = {
  referrer: "origin" as const,
};

export default function MfCasCallbackPage() {
  return (
    <Suspense>
      <MfCasCallbackHost />
    </Suspense>
  );
}
