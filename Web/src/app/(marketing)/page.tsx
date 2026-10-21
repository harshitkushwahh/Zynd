import { HomeFeaturesSection } from "@/features/marketing/components/home/home-features-section";
import { HomeHeroSection } from "@/features/marketing/components/home/home-hero-section";
import { HomeHeroTrustSection } from "@/features/marketing/components/home/home-hero-trust-section";
import { HomeProductsSection } from "@/features/marketing/components/home/home-products-section";
import { LandingAboutStrip } from "@/features/marketing/components/landing-about-strip";

export default function HomePage() {
  return (
    <>
      <HomeHeroSection />
      <HomeHeroTrustSection />
      <HomeFeaturesSection />
      <HomeProductsSection />
      <LandingAboutStrip />
    </>
  );
}
