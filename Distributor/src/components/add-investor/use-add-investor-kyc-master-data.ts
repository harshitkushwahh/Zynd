"use client";

import { useEffect, useState } from "react";

import {
  ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS,
  type AddInvestorKycMasterData,
} from "@/lib/add-investor/add-investor-kyc-master-data";
import {
  fetchDistributorKycCountries,
  fetchDistributorKycMasterDataEnums,
  fetchDistributorKycNomineeEnums,
  fetchDistributorKycStates,
} from "@/lib/distributor-kyc-master-data-api";
import { ADD_INVESTOR_INDIAN_STATES } from "@/lib/add-investor/add-investor-address-options";
import { ADD_INVESTOR_PERSONAL_OPTIONS } from "@/lib/add-investor/add-investor-journey";
import {
  ADD_INVESTOR_NOMINEE_DOCUMENT_TYPES,
  ADD_INVESTOR_NOMINEE_RELATIONSHIPS,
  ADD_INVESTOR_NOMINEE_SOURCE_OF_WEALTH,
} from "@/lib/add-investor/add-investor-nominee";

const FALLBACK_COUNTRY_OPTIONS = ADD_INVESTOR_PERSONAL_OPTIONS.countryOfOrigin.map((item) => ({
  label: item.label,
  value: item.label,
}));

export function useAddInvestorKycMasterData() {
  const [masterData, setMasterData] = useState<AddInvestorKycMasterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [enumsResult, statesResult, countriesResult, nomineeResult] = await Promise.allSettled([
          fetchDistributorKycMasterDataEnums(),
          fetchDistributorKycStates(),
          fetchDistributorKycCountries(),
          fetchDistributorKycNomineeEnums(),
        ]);

        if (cancelled) return;

        const enums =
          enumsResult.status === "fulfilled"
            ? enumsResult.value
            : {
                gender: [...ADD_INVESTOR_PERSONAL_OPTIONS.gender],
                marital_status: [...ADD_INVESTOR_PERSONAL_OPTIONS.maritalStatus],
                occupation: [...ADD_INVESTOR_PERSONAL_OPTIONS.occupation],
                income_slab: [...ADD_INVESTOR_PERSONAL_OPTIONS.incomeSlab],
                pep_exposed: [...ADD_INVESTOR_PERSONAL_OPTIONS.pepExposed],
              };

        const states =
          statesResult.status === "fulfilled"
            ? statesResult.value.map((item) => item.name).filter(Boolean)
            : [...ADD_INVESTOR_INDIAN_STATES];

        const countries =
          countriesResult.status === "fulfilled"
            ? countriesResult.value.map((item) => ({ label: item.name, value: item.name }))
            : FALLBACK_COUNTRY_OPTIONS;

        const nominee =
          nomineeResult.status === "fulfilled"
            ? nomineeResult.value
            : {
                relationships: [...ADD_INVESTOR_NOMINEE_RELATIONSHIPS],
                source_of_wealth: [...ADD_INVESTOR_NOMINEE_SOURCE_OF_WEALTH],
                document_types: [...ADD_INVESTOR_NOMINEE_DOCUMENT_TYPES],
              };

        if (
          enumsResult.status === "rejected" &&
          statesResult.status === "rejected" &&
          countriesResult.status === "rejected"
        ) {
          throw enumsResult.reason;
        }

        setMasterData({
          personal: {
            gender: enums.gender,
            maritalStatus: enums.marital_status,
            occupation: enums.occupation,
            incomeSlab: enums.income_slab,
            pepExposed: enums.pep_exposed,
            countryOfOrigin: countries,
          },
          nominee: {
            relationships: nominee.relationships,
            sourceOfWealth: nominee.source_of_wealth,
            documentTypes: nominee.document_types,
          },
          bankAccountTypes: ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS,
          states: states.length > 0 ? states : [...ADD_INVESTOR_INDIAN_STATES],
          countries,
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load KYC options.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { masterData, loading, error };
}
