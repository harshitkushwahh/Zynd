import { SupportLoginCard } from "@/components/auth/support-login-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SupportLoginPage() {
  return <SupportLoginCard />;
}
