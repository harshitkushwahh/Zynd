import type { Metadata } from "next";

import { DistributorResetPinPage } from "@/components/auth/distributor-reset-pin-page";

export const metadata: Metadata = {
  title: "Reset PIN",
};

export default function ResetPinRoutePage() {
  return <DistributorResetPinPage />;
}
