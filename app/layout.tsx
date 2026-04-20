import type { Metadata } from "next";
import { DM_Serif_Display, Space_Grotesk } from "next/font/google";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import SiteIntroOverlay from "@/components/SiteIntroOverlay";
import { absoluteUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-content";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  createJsonLd,
} from "@/lib/structured-data";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
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
    icon: "/cgs-logo.png",
    apple: "/cgs-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${dmSerifDisplay.variable}`}
    >
      <body className="text-white antialiased">
        <div className="site-shell">
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <SiteIntroOverlay />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={createJsonLd(buildOrganizationJsonLd())}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={createJsonLd(buildWebsiteJsonLd())}
          />
          <SiteHeader />
          <div id="main-content">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
