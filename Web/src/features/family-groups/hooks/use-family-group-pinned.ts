"use client";

import { useCallback, useEffect, useState } from "react";

import {
  readPinnedFamilyGroupId,
  writePinnedFamilyGroupId,
} from "@/features/family-groups/lib/family-group-pinned-storage";

export function useFamilyGroupPinned(userId: string | null | undefined) {
  const [pinnedGroupId, setPinnedGroupId] = useState<string | null>(null);

  useEffect(() => {
    setPinnedGroupId(readPinnedFamilyGroupId(userId));
  }, [userId]);

  const togglePin = useCallback(
    (groupId: string) => {
      if (!userId) return;
      setPinnedGroupId((current) => {
        const next = current === groupId ? null : groupId;
        writePinnedFamilyGroupId(userId, next);
        return next;
      });
    },
    [userId],
  );

  const isPinned = useCallback(
    (groupId: string) => pinnedGroupId === groupId,
    [pinnedGroupId],
  );

  return { pinnedGroupId, togglePin, isPinned };
}
