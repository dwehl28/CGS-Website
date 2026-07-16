import type { Metadata, Viewport } from "next";

import SiteChrome from "@/components/SiteChrome";
import { absoluteUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-content";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  createJsonLd,
} from "@/lib/structured-data";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: "CGS Golf",
  keywords: [
    "golf",
    "golf community",
    "Crossodog Golf Society",
    "CGS",
    "golf events",
    "golf content",
  ],
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    locale: "en_AU",
    type: "website",
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [absoluteUrl("/twitter-image")],
  },
  icons: {
    icon: [
      { url: "/cgs-golf-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/cgs-golf-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "CGS Golf",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={createJsonLd(buildOrganizationJsonLd())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={createJsonLd(buildWebsiteJsonLd())}
        />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
