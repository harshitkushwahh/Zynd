"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useDistributorListScopeSwitch } from "@/components/workspace/use-distributor-list-scope-switch";
import {
  buildYourClientsListHref,
  type DistributorClientsListScope,
} from "@/lib/distributor-clients-list-scope";

type UseYourClientsScopeSwitchOptions = {
  urlScope: DistributorClientsListScope;
};

export function useYourClientsScopeSwitch({ urlScope }: UseYourClientsScopeSwitchOptions) {
  const router = useRouter();

  const onNavigate = useCallback(
    (scope: DistributorClientsListScope) => {
      router.replace(buildYourClientsListHref(scope));
    },
    [router],
  );

  return useDistributorListScopeSwitch({
    urlScope,
    onNavigate,
  });
}
