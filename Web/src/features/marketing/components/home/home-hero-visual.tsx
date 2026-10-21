import Image from "next/image";

import { HomeHeroMfPreviewCard } from "@/features/marketing/components/home/home-hero-mf-preview-card";

export function HomeHeroVisual() {
  return (
    <div className="landing-hero-visual-stage relative mx-auto w-full max-w-[min(100%,28rem)] lg:max-w-[min(100%,32rem)]">
      <div className="relative z-10 w-full px-1 pb-24 sm:pb-28">
        <Image
          src="/heror.png"
          alt=""
          width={480}
          height={480}
          className="relative z-10 mx-auto max-h-[24rem] w-full max-w-[22rem] object-contain object-center drop-shadow-2xl sm:max-h-[26rem] sm:max-w-[24rem]"
          style={{ width: "auto", height: "auto" }}
          priority
        />
        <HomeHeroMfPreviewCard />
      </div>
    </div>
  );
}
