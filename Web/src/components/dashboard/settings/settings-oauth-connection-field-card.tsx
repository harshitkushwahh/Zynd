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
    iconShell: (connected: boolean) => string;
  }
> = {
  google: {
    label: copy.settings.googleLabel,
    connectedShell:
      "border-success/25 bg-card ring-1 ring-success/10",
    Icon: GoogleIcon,
    iconShell: () => "bg-background ring-border/60",
  },
  apple: {
    label: copy.settings.appleLabel,
    connectedShell: "border-border/70 bg-card ring-1 ring-border/40",
    Icon: AppleIcon,
    iconShell: (connected) =>
      connected
        ? "bg-foreground text-background ring-foreground/20"
        : "bg-muted text-foreground ring-border/60",
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
        "flex min-h-[5.25rem] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-border/60 bg-card p-4 shadow-zynd-low transition-[border-color,box-shadow] duration-200 hover:border-primary/20 hover:shadow-zynd-mid",
        connected && meta.connectedShell,
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] ring-1 ring-inset",
            meta.iconShell(connected),
          )}
        >
          <Icon className={provider === "google" ? "size-4" : "size-4 text-inherit"} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {meta.label}
        </span>
      </div>
      <p className="mt-3 pl-[2.625rem] text-body font-medium leading-snug text-foreground">
        {connected ? email || copy.settings.connected : copy.settings.notConnected}
      </p>
    </div>
  );
}
