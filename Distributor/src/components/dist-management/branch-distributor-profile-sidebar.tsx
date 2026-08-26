"use client";

import { useCallback, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Building2, Check, Copy, Hash, MapPin, Phone } from "lucide-react";

import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import type { BranchDistributorProfile } from "@/lib/distributor-branch-distributor-profile-data";
import { formatDistributorBranchName } from "@/lib/distributor-branch-display";
import { formatDistributorProfileAddress } from "@/lib/distributor-profile";
import { cn } from "@/lib/utils";

type BranchDistributorProfileSidebarProps = {
  profile: BranchDistributorProfile;
  className?: string;
};

function statusVariant(status: BranchDistributorProfile["status"]) {
  if (status === "Active") return "success" as const;
  if (status === "Paused") return "warning" as const;
  return "neutral" as const;
}

function BranchDistributorRegistrationRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <div className="distributor-branch-distributor-sidebar__registration-row">
      <span className="distributor-branch-distributor-sidebar__registration-icon" aria-hidden>
        <Icon strokeWidth={2.25} />
      </span>
      <div className="distributor-branch-distributor-sidebar__registration-copy">
        <span className="distributor-branch-distributor-sidebar__registration-value tabular-nums">
          {value}
        </span>
        <span className="distributor-branch-distributor-sidebar__contact-label">{label}</span>
      </div>
      <button
        type="button"
        className={cn(
          "distributor-branch-distributor-sidebar__registration-action",
          copied && "distributor-branch-distributor-sidebar__registration-action--copied",
        )}
        onClick={() => void onCopy()}
        aria-label={copied ? `${label} copied` : `Copy ${label} ${value}`}
      >
        {copied ? <Check strokeWidth={2.5} /> : <Copy strokeWidth={2.25} />}
      </button>
    </div>
  );
}

function RegistrationDivider() {
  return (
    <div
      className="distributor-branch-distributor-sidebar__registration-divider"
      role="separator"
      aria-hidden
    />
  );
}

export function BranchDistributorProfileSidebar({
  profile,
  className,
}: BranchDistributorProfileSidebarProps) {
  const addressLabel = formatDistributorProfileAddress(profile.address);
  const branchLabel = formatDistributorBranchName(profile.branchName);

  return (
    <article
      className={cn("distributor-branch-distributor-sidebar", className)}
      aria-label={`${profile.name} profile`}
    >
      <div className="distributor-branch-distributor-sidebar__hero">
        <div className="distributor-branch-distributor-sidebar__avatar-wrap">
          <DistributorProfileAvatar
            name={profile.name}
            imageSrc={profile.avatarUrl}
            size="lg"
            className="distributor-branch-distributor-sidebar__avatar"
          />
        </div>

        <div className="distributor-branch-distributor-sidebar__identity">
          <h1 className="distributor-branch-distributor-sidebar__name">{profile.name}</h1>
          <p className="distributor-branch-distributor-sidebar__email">{profile.email}</p>
        </div>

        <div className="distributor-branch-distributor-sidebar__status">
          <StatusBadge variant={statusVariant(profile.status)}>{profile.status}</StatusBadge>
        </div>
      </div>

      <div className="distributor-branch-distributor-sidebar__contact">
        <div className="distributor-branch-distributor-sidebar__contact-row">
          <span className="distributor-branch-distributor-sidebar__contact-icon" aria-hidden>
            <Phone strokeWidth={2.25} />
          </span>
          <span className="distributor-branch-distributor-sidebar__contact-copy">
            <span className="distributor-branch-distributor-sidebar__contact-label">Mobile</span>
            <span className="distributor-branch-distributor-sidebar__contact-value tabular-nums">
              {profile.mobile}
            </span>
          </span>
        </div>
        <div className="distributor-branch-distributor-sidebar__contact-row">
          <span className="distributor-branch-distributor-sidebar__contact-icon" aria-hidden>
            <MapPin strokeWidth={2.25} />
          </span>
          <span className="distributor-branch-distributor-sidebar__contact-copy">
            <span className="distributor-branch-distributor-sidebar__contact-label">Address</span>
            <span className="distributor-branch-distributor-sidebar__contact-value">
              {addressLabel}
            </span>
          </span>
        </div>
        <div className="distributor-branch-distributor-sidebar__contact-row">
          <span className="distributor-branch-distributor-sidebar__contact-icon" aria-hidden>
            <Building2 strokeWidth={2.25} />
          </span>
          <span className="distributor-branch-distributor-sidebar__contact-copy">
            <span className="distributor-branch-distributor-sidebar__contact-label">Branch</span>
            <span className="distributor-branch-distributor-sidebar__contact-value">
              {branchLabel}
            </span>
          </span>
        </div>

        <RegistrationDivider />

        <BranchDistributorRegistrationRow icon={Hash} label="Zynd Mitra ID" value={profile.id} />
        <BranchDistributorRegistrationRow icon={Hash} label="ARN" value={profile.arn} />
        <BranchDistributorRegistrationRow icon={BadgeCheck} label="EUIN" value={profile.euin} />
      </div>
    </article>
  );
}
