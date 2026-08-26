"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useKycOptional } from "@/contexts/kyc-context";

/** Deep-link target for notifications — opens the KYC dialog, then returns to dashboard home. */
export default function DashboardKycPage() {
  const router = useRouter();
  const kyc = useKycOptional();

  useEffect(() => {
    kyc?.openDialog();
    router.replace("/dashboard");
  }, [kyc, router]);

  return null;
}
