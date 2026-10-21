import { MarketingPageIntro } from "@/features/marketing/components/marketing-page-intro";
import { copy } from "@/shared/config/copy";

export default function AboutPage() {
  return (
    <MarketingPageIntro
      eyebrow={copy.marketing.aboutEyebrow()}
      title={copy.marketing.aboutHeadline}
      description={`${copy.marketing.heroLead()} ${copy.marketing.heroSublead}`}
      centered
      className="pb-24"
    />
  );
}
