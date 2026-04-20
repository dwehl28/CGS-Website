import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";
import { getPublishedCompetitionScoreboards } from "@/lib/scoreboards";
import { events, siteRoutes } from "@/lib/site-content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = siteRoutes.map((link) => ({
    url: absoluteUrl(link.href),
    lastModified: now,
    changeFrequency: link.href === "/" ? "weekly" : "monthly",
    priority: link.href === "/" ? 1 : 0.7,
  }));

  const eventRoutes: MetadataRoute.Sitemap = events.map((event) => ({
    url: absoluteUrl(event.href),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const scoreboardFeed = await getPublishedCompetitionScoreboards();
  const scoreboardRoutes: MetadataRoute.Sitemap = scoreboardFeed.competitions.map(
    (competition) => ({
      url: absoluteUrl(`/scoreboard/${competition.slug}`),
      lastModified: competition.updatedAt || now,
      changeFrequency: competition.isLive ? "daily" : "weekly",
      priority: competition.isLive ? 0.9 : 0.75,
    })
  );

  return [...staticRoutes, ...eventRoutes, ...scoreboardRoutes];
}
