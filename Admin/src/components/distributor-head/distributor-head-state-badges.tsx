import { MapPin, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DUMMY_STATE_HEAD } from "@/lib/dummy/distributor-head-data";

export function DistributorHeadStateBadges() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="h-6 gap-1.5 px-2.5 py-0 text-xs font-normal">
        <MapPin className="size-3" />
        {DUMMY_STATE_HEAD.state} ({DUMMY_STATE_HEAD.stateCode})
      </Badge>
      <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 py-0 text-xs font-normal">
        <UserRound className="size-3" />
        {DUMMY_STATE_HEAD.roleLabel}: {DUMMY_STATE_HEAD.name}
      </Badge>
    </div>
  );
}
