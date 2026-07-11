import { SiteHeader } from "@/components/auth/auth-header-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/shared/config/copy";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24">
        <div className="max-w-2xl">
          <p className="mb-4 text-compact font-medium text-primary">
            {copy.marketing.heroTagline}
          </p>
          <h1 className="text-display font-bold leading-tight tracking-tight text-foreground">
            {copy.marketing.heroHeadline}
          </h1>
          <p className="mt-6 text-body text-muted-foreground">
            {copy.marketing.heroLead()} {copy.marketing.heroSublead}
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {copy.marketing.featureCards.map((item) => (
            <Card key={item.label}>
              <CardHeader>
                <CardTitle className="text-primary">{item.label}</CardTitle>
                <CardDescription>{item.value}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
