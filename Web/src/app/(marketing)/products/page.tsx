import { MarketingPageIntro } from "@/features/marketing/components/marketing-page-intro";
import { copy } from "@/shared/config/copy";

export default function ProductsPage() {
  return (
    <>
      <MarketingPageIntro
        eyebrow={copy.marketing.productsEyebrow}
        title={copy.marketing.productsPage.title}
        description={copy.marketing.productsLead}
        centered
      />
      <section className="mx-auto grid max-w-4xl gap-4 px-6 pb-20 sm:grid-cols-2 sm:px-8">
        {copy.marketing.productsPage.items.map((item) => (
          <article
            key={item.title}
            className="rounded-[var(--radius-card)] border border-border/80 bg-background/90 p-5 shadow-zynd-low"
          >
            <h2 className="text-h4 font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-compact leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
