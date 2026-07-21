import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AppProviders } from "@/components/providers";
import { appTitle } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";
import { rootFontClassName } from "@/shared/config/fonts";
import { storageKeys } from "@/shared/config/storage-keys";
import { parseThemeCookie } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: appTitle(),
  description: copy.meta.siteDescription,
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = parseThemeCookie(cookieStore.get(storageKeys.theme)?.value);
  const isDark = themeCookie === "dark";

  return (
    <html
      lang="en"
      className={`${rootFontClassName} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
