"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useResolvedDisplayName } from "@/shared/hooks/use-resolved-display-name";
import { APP_NAME } from "@/shared/config/brand";

export function AuthHeaderActions() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const resolvedDisplayName = useResolvedDisplayName();

  if (loading) {
    return <div className="h-9 w-28 animate-pulse rounded-[var(--radius-control)] bg-muted" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden max-w-[160px] truncate text-compact text-muted-foreground sm:inline">
          {resolvedDisplayName || user.email}
        </span>
        <Button className="shadow-zynd-mid" onClick={() => router.push("/dashboard")}>
          Dashboard
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return <AuthDialog />;
}

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background shadow-zynd-low">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-h4 font-bold tracking-tight text-foreground">
          {APP_NAME}
        </Link>
        <AuthHeaderActions />
      </div>
    </header>
  );
}
