"use client";

import { BrandDialog } from "@/components/ui/brand-dialog";
import { MfTransactionConsentOtpSection } from "@/features/invest/components/mf-transaction-consent-otp-section";
import {
  addInvestorNominee,
  sendSettingsNomineeConsentOtp,
} from "@/features/kyc/lib/kyc-api";
import type { KycNomineeRecord } from "@/features/kyc/lib/kyc-nominee";
import { copy } from "@/shared/config/copy";

type SettingsNomineeConsentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomineesToSave: KycNomineeRecord[];
  onConfirmed: () => void | Promise<void>;
};

export function SettingsNomineeConsentDialog({
  open,
  onOpenChange,
  nomineesToSave,
  onConfirmed,
}: SettingsNomineeConsentDialogProps) {
  const settingsCopy = copy.settings;

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={settingsCopy.nomineesConsentTitle}
      maxWidth="md"
      className="max-h-[min(32rem,92dvh)]"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <p className="shrink-0 px-5 pb-3 text-[11px] leading-relaxed text-muted-foreground sm:px-6">
          {settingsCopy.nomineesConsentIntro}
        </p>
        <MfTransactionConsentOtpSection
          active={open}
          skipInitialLoad
          autoSendOtp
          embedded
          autoContinueOnConfirm
          className="min-h-0 flex-1 px-5 pb-5 sm:px-6 sm:pb-6"
          loadConsent={async () => ({ masked_mobile: "" })}
          sendOtp={sendSettingsNomineeConsentOtp}
          confirmOtp={async (otp): Promise<void> => {
            await addInvestorNominee(nomineesToSave, otp);
          }}
          onConfirmed={() => void onConfirmed()}
          onCancel={() => onOpenChange(false)}
          cancelLabel={settingsCopy.nomineesConsentCancel}
          confirmLabel={settingsCopy.nomineesConsentConfirm}
          loadFailedMessage={settingsCopy.nomineesConsentSendFailed}
          confirmFailedMessage={settingsCopy.nomineesConsentVerifyFailed}
          successTitle={settingsCopy.nomineeAdded}
          successDescription={settingsCopy.nomineesConsentSuccessBody}
        />
      </div>
    </BrandDialog>
  );
}
