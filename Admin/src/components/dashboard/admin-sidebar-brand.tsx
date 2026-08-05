"use client";

import Image from "next/image";
import Link from "next/link";

import { useTheme } from "@/contexts/theme-context";

export function AdminSidebarBrand() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/zynda-h.png" : "/zynd-hl.png";

  return (
    <Link href="/dashboard" className="admin-sidebar-brand" aria-label="ZYND Admin home">
      <Image
        src={logoSrc}
        alt="ZYND Admin"
        width={893}
        height={242}
        className="admin-sidebar-brand__logo-horizontal"
        priority
      />
    </Link>
  );
}
