import type { Metadata } from "next";

import { siteConfig } from "@/lib/site-content";

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.siteUrl).toString();
}

type BuildMetadataOptions = {
  title: string;
  description: string;
  path: string;
};

export function buildMetadata({
  title,
  description,
  path,
}: BuildMetadataOptions): Metadata {
  const openGraphImage = absoluteUrl("/opengraph-image");
  const twitterImage = absoluteUrl("/twitter-image");

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(path),
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName: siteConfig.name,
      locale: "en_AU",
      type: "website",
      images: [
        {
          url: openGraphImage,
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImage],
    },
  };
}
