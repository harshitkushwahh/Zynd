import { DistributorLoginCard } from "@/components/auth/distributor-login-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function DistributorLoginPage() {
  return <DistributorLoginCard />;
}
