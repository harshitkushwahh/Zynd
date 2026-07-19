"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Link2,
  Mail,
  QrCode,
  Share2,
} from "lucide-react";

import { ReferralQrDialog } from "@/features/referral/components/referral-qr-dialog";
import referIllustration from "@/features/referral/assets/refer-illustration.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralShareHeroCardProps = {
  shareUrl: string;
  code: string;
};

type SocialShareOption = {
  id: string;
  label: string;
  icon: ReactNode;
  buttonClassName: string;
  href?: string;
  onClick?: () => void;
};

const SOCIAL_BRAND_BUTTON_CLASS: Record<string, string> = {
  whatsapp: "bg-[#25D366] text-white hover:bg-[#20BD5A]",
  x: "bg-black text-white hover:bg-neutral-800",
  linkedin: "bg-[#0A66C2] text-white hover:bg-[#0958AA]",
  email: "bg-[#EA4335] text-white hover:bg-[#D93025]",
  more: "bg-white text-[var(--zynd-neutral-900)] hover:bg-white/90",
};

const socialIconButtonClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors shadow-zynd-low";

const glassControlClass = cn(
  "border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground",
  "backdrop-blur-md shadow-none",
  "placeholder:text-primary-foreground/50",
  "focus-visible:ring-primary-foreground/30"
);

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2C6.477 2 2 6.477 2 12.004c0 1.76.458 3.415 1.26 4.855L2 22l5.292-1.238A9.953 9.953 0 0 0 12.004 22C17.53 22 22 17.523 22 12.004 22 6.477 17.53 2 12.004 2zm0 18.133a8.12 8.12 0 0 1-4.135-1.13l-.296-.176-3.14.734.748-3.062-.193-.31A8.12 8.12 0 0 1 3.867 12c0-4.492 3.645-8.137 8.137-8.137s8.137 3.645 8.137 8.137-3.645 8.133-8.137 8.133z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function buildShareMessage(url: string) {
  return copy.referral.shareMessage.replace("{url}", url);
}

export function ReferralShareHeroCard({ shareUrl, code }: ReferralShareHeroCardProps) {
  const [copied, setCopied] = useState(false);
  const [codeTooltipOpen, setCodeTooltipOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const codeCopyTimeoutRef = useRef<number | null>(null);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      if (codeCopyTimeoutRef.current !== null) {
        window.clearTimeout(codeCopyTimeoutRef.current);
      }
      setCodeTooltipOpen(true);
      codeCopyTimeoutRef.current = window.setTimeout(() => {
        setCodeTooltipOpen(false);
        codeCopyTimeoutRef.current = null;
      }, 2000);
    } catch {
      setCodeTooltipOpen(false);
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: copy.referral.shareNativeTitle,
        text: buildShareMessage(shareUrl),
        url: shareUrl,
      });
    } catch {
      // User dismissed share sheet.
    }
  };

  const shareMessage = encodeURIComponent(buildShareMessage(shareUrl));
  const shareUrlEncoded = encodeURIComponent(shareUrl);

  const socialOptions: SocialShareOption[] = [
    {
      id: "whatsapp",
      label: copy.referral.socialWhatsApp,
      buttonClassName: SOCIAL_BRAND_BUTTON_CLASS.whatsapp,
      icon: <WhatsAppIcon className="size-4" />,
      href: `https://wa.me/?text=${shareMessage}`,
    },
    {
      id: "x",
      label: copy.referral.socialX,
      buttonClassName: SOCIAL_BRAND_BUTTON_CLASS.x,
      icon: <XIcon className="size-4" />,
      href: `https://twitter.com/intent/tweet?text=${shareMessage}`,
    },
    {
      id: "linkedin",
      label: copy.referral.socialLinkedIn,
      buttonClassName: SOCIAL_BRAND_BUTTON_CLASS.linkedin,
      icon: <LinkedInIcon className="size-4" />,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrlEncoded}`,
    },
    {
      id: "email",
      label: copy.referral.socialEmail,
      buttonClassName: SOCIAL_BRAND_BUTTON_CLASS.email,
      icon: <Mail className="size-4" strokeWidth={2.25} />,
      href: `mailto:?subject=${encodeURIComponent(copy.referral.shareEmailSubject)}&body=${shareMessage}`,
    },
    {
      id: "more",
      label: copy.referral.socialMore,
      buttonClassName: SOCIAL_BRAND_BUTTON_CLASS.more,
      icon: <Share2 className="size-4" strokeWidth={2.25} />,
      onClick: () => void handleNativeShare(),
    },
  ];

  return (
    <>
      <section className={cn("relative w-full max-w-full overflow-hidden bg-gradient-brand p-4 shadow-zynd-mid sm:p-5", REFERRAL_CARD_RADIUS_CLASS)}>
        <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 size-32 rounded-full bg-[color-mix(in_srgb,var(--zynd-emerald)_30%,transparent)] blur-3xl" />

        <div className="pointer-events-none absolute right-3 top-6 z-10 hidden sm:block">
          <div className="relative h-20 w-24 lg:h-[5.75rem] lg:w-[6.75rem]">
            <Image
              src={referIllustration}
              alt=""
              fill
              sizes="(min-width: 1024px) 6.75rem, 6rem"
              className="object-contain object-top mix-blend-screen drop-shadow-md"
              priority
            />
          </div>
        </div>

        <div className="relative z-10 w-full space-y-3 sm:pr-28 lg:pr-[7.5rem]">
          <div className="space-y-1.5">
            <p className="text-h4 font-semibold tracking-tight text-primary-foreground">
              {copy.referral.shareTitle}
            </p>
            <p className="max-w-xl text-compact leading-relaxed text-primary-foreground/85">
              {copy.referral.shareHint}
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                aria-label={copy.referral.shareTitle}
                className={cn(
                  "h-10 min-w-0 flex-1 truncate font-mono text-caption",
                  glassControlClass
                )}
              />
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-10 shrink-0 gap-2 transition-colors duration-200 ease-in-out",
                  glassControlClass,
                  "hover:bg-primary-foreground/25 hover:text-primary-foreground"
                )}
                onClick={() => void handleCopy()}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? copy.referral.copied : copy.referral.copyLink}
              </Button>
            </div>

            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:gap-3">
              <div className="flex shrink-0 items-center gap-2">
                {socialOptions.map((option) =>
                  option.href ? (
                    <a
                      key={option.id}
                      href={option.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={option.label}
                      title={option.label}
                      className={cn(socialIconButtonClass, option.buttonClassName)}
                    >
                      {option.icon}
                    </a>
                  ) : (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={option.label}
                      title={option.label}
                      onClick={option.onClick}
                      className={cn(socialIconButtonClass, option.buttonClassName)}
                    >
                      {option.icon}
                    </button>
                  )
                )}
              </div>

              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  aria-hidden
                  className="hidden h-7 w-px shrink-0 bg-primary-foreground/30 xl:block"
                />

                <div className="flex min-w-0 flex-nowrap items-center gap-2">
                  <Tooltip open={codeTooltipOpen} onOpenChange={setCodeTooltipOpen}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={`${copy.referral.copyCodeLabel}: ${code}`}
                          onClick={() => void handleCopyCode()}
                          className={cn(
                            "inline-flex max-w-full items-center gap-2 rounded-[var(--radius-full)] px-3 py-1.5 whitespace-nowrap",
                            "cursor-pointer transition-colors hover:bg-primary-foreground/25",
                            glassControlClass
                          )}
                        >
                          <Link2 className="size-3.5 shrink-0 text-primary-foreground/80" strokeWidth={2.25} />
                          <span className="shrink-0 text-caption text-primary-foreground/75">
                            {copy.referral.codeLabel}
                          </span>
                          <span className="truncate font-mono text-compact font-semibold tracking-wide">
                            {code}
                          </span>
                        </button>
                      }
                    />
                    <TooltipContent side="top">{copy.referral.copied}</TooltipContent>
                  </Tooltip>

                  <button
                    type="button"
                    onClick={() => setQrOpen(true)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-full)] px-3 py-1.5 whitespace-nowrap",
                      "text-caption font-medium transition-colors hover:bg-primary-foreground/25",
                      glassControlClass
                    )}
                  >
                    <QrCode className="size-3.5 shrink-0" strokeWidth={2.25} />
                    {copy.referral.qrButton}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ReferralQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        shareUrl={shareUrl}
        code={code}
      />
    </>
  );
}
