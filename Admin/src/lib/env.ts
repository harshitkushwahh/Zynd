export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "ZYND Admin",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  zyndWebUrl: process.env.NEXT_PUBLIC_ZYND_WEB_URL ?? "http://localhost:7777",
  distributorUrl: process.env.NEXT_PUBLIC_DISTRIBUTOR_URL ?? "http://localhost:9900",
  zyndAndroidUrl:
    process.env.NEXT_PUBLIC_ZYND_ANDROID_URL ??
    "https://play.google.com/store/apps/details?id=in.zynd.mobile",
  zyndIosUrl:
    process.env.NEXT_PUBLIC_ZYND_IOS_URL ??
    "https://apps.apple.com/app/zynd-invest/id0000000000",
} as const;
