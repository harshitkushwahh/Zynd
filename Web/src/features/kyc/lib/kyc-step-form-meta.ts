import {
  Building2,
  CreditCard,
  ListChecks,
  MapPin,
  PenLine,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { KycJourneyStepId } from "@/features/kyc/lib/kyc-journey";
import { copy } from "@/shared/config/copy";

export type KycStepFormMeta = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function getKycStepFormMeta(stepId?: KycJourneyStepId): KycStepFormMeta {
  switch (stepId) {
    case "pan-card":
      return {
        icon: CreditCard,
        title: copy.kyc.steps.panCard,
        description: copy.kyc.pan.stepDescription,
      };
    case "address":
      return {
        icon: MapPin,
        title: copy.kyc.steps.address,
        description: copy.kyc.brandPanel.stepDescriptions.address,
      };
    case "personal-info":
      return {
        icon: UserRound,
        title: copy.kyc.steps.personalInfo,
        description: copy.kyc.brandPanel.stepDescriptions.personalInfo,
      };
    case "nominee":
      return {
        icon: Users,
        title: copy.kyc.steps.nominee,
        description: copy.kyc.brandPanel.stepDescriptions.nominee,
      };
    case "bank":
      return {
        icon: Building2,
        title: copy.kyc.steps.bank,
        description: copy.kyc.brandPanel.stepDescriptions.bank,
      };
    case "signature":
      return {
        icon: PenLine,
        title: copy.kyc.steps.signature,
        description: copy.kyc.brandPanel.stepDescriptions.signature,
      };
    case "review":
      return {
        icon: ListChecks,
        title: copy.kyc.steps.review,
        description: copy.kyc.review.descriptionLines.join(" "),
      };
    default:
      return {
        icon: ShieldCheck,
        title: copy.kyc.pageTitle,
        description: copy.kyc.pageDescription,
      };
  }
}
