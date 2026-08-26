import { AppleIcon, GoogleIcon } from "@/components/auth/oauth-provider-icons";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type OAuthProvider = "google" | "apple";

const PROVIDER_META: Record<
  OAuthProvider,
  {
    label: string;
    connectedShell: string;
    Icon: typeof GoogleIcon;
  }
> = {
  google: {
    label: copy.settings.googleLabel,
    connectedShell:
      "border-success/25 bg-card ring-1 ring-success/10",
    Icon: GoogleIcon,
  },
  apple: {
    label: copy.settings.appleLabel,
    connectedShell: "border-border/70 bg-card ring-1 ring-border/40",
    Icon: AppleIcon,
  },
};

type SettingsOAuthConnectionFieldCardProps = {
  provider: OAuthProvider;
  connected: boolean;
  email?: string | null;
  className?: string;
};

export function SettingsOAuthConnectionFieldCard({
  provider,
  connected,
  email,
  className,
}: SettingsOAuthConnectionFieldCardProps) {
  const meta = PROVIDER_META[provider];
  const { Icon } = meta;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col justify-between overflow-hidden rounded-[var(--radius-control)] border border-border/60 bg-card p-3 shadow-zynd-low",
        connected && meta.connectedShell,
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/50",
            provider === "apple" && connected && "bg-foreground text-background ring-foreground/20",
            provider === "google" && connected && "bg-background text-foreground",
          )}
        >
          <Icon className="size-3 text-inherit" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {meta.label}
        </span>
      </div>
      <p className="mt-1.5 pl-[1.875rem] text-compact font-medium leading-snug text-foreground">
        {connected ? email || copy.settings.connected : copy.settings.notConnected}
      </p>
    </div>
  );
}
