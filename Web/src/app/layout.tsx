import type { Metadata } from "next";
import { AppProviders } from "@/components/providers";
import { appTitle } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";
import { rootFontClassName } from "@/shared/config/fonts";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: appTitle(),
  description: copy.meta.siteDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${rootFontClassName} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
