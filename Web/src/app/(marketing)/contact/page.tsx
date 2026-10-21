import Link from "next/link";

import { MarketingPageIntro } from "@/features/marketing/components/marketing-page-intro";
import { copy } from "@/shared/config/copy";

export default function ContactPage() {
  const { footer, contactPage } = copy.marketing;

  return (
    <>
      <MarketingPageIntro
        eyebrow={contactPage.eyebrow}
        title={contactPage.title}
        description={contactPage.description}
        centered
      />
      <section className="mx-auto flex max-w-lg flex-col items-center px-6 pb-24 sm:px-8">
        <a
          href={`mailto:${footer.workContactEmail}`}
          className="landing-footer-contact-pill inline-flex w-full flex-col items-center gap-1 rounded-[var(--radius-card)] px-6 py-5 text-center sm:flex-row sm:justify-center sm:gap-2"
        >
          <span className="text-compact text-slate-700 dark:text-white/85">
            {footer.workContactPrefix}
          </span>
          <span className="text-compact font-medium text-primary dark:text-emerald-300">
            {footer.workContactEmail}
          </span>
        </a>
        <p className="mt-6 text-center text-compact text-muted-foreground">
          {contactPage.helpHint}{" "}
          <Link href="/dashboard/help" className="text-primary hover:underline">
            {contactPage.helpLinkLabel}
          </Link>
        </p>
      </section>
    </>
  );
}
