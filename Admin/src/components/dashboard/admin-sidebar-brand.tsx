"use client";

import Image from "next/image";
import Link from "next/link";

const LOGO_WIDTH = 893;
const LOGO_HEIGHT = 242;

export function AdminSidebarBrand() {
  return (
    <Link href="/dashboard" className="admin-sidebar-brand" aria-label="ZYND Admin home">
      <Image
        src="/zynd-hl.png"
        alt="ZYND Admin"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className="admin-sidebar-brand__logo-horizontal dark:hidden"
        priority
      />
      <Image
        src="/zynda-h.png"
        alt=""
        aria-hidden
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className="admin-sidebar-brand__logo-horizontal hidden dark:block"
        priority
      />
    </Link>
  );
}
