"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { userInitials } from "@/lib/admin-capabilities";
import { resolveAdminAssetUrl } from "@/lib/mf-admin-asset-url";
import type { LockedRiskProfileUser } from "@/lib/risk-profile-admin-api";

export function LockedProfileUserCell({ user }: { user: LockedRiskProfileUser }) {
  const profileUrl = resolveAdminAssetUrl(user.profile_image_url);

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-7">
        {profileUrl ? <AvatarImage src={profileUrl} alt="" /> : null}
        <AvatarFallback className="text-micro">
          {userInitials(user.display_name || user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{user.display_name}</p>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {user.email}
          {user.client_id ? (
            <>
              {" · "}
              <span className="font-mono">{user.client_id}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
