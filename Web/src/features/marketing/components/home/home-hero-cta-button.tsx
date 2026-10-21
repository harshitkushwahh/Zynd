"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { AuthDialogSurface } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { landingGetStartedButtonClassName } from "@/features/marketing/lib/landing-get-started-button";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type HomeHeroCtaButtonProps = {
  className?: string;
};

export function HomeHeroCtaButton({ className }: HomeHeroCtaButtonProps) {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <AuthDialogSurface
      open={authOpen}
      onOpenChange={setAuthOpen}
      triggers={
        <Button
          type="button"
          size="sm"
          className={cn(landingGetStartedButtonClassName, className)}
          onClick={() => setAuthOpen(true)}
        >
          {copy.marketing.navGetStarted}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      }
    />
  );
}
