import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StreamScoreboardBanner from "@/components/scoreboard/StreamScoreboardBanner";
import { resolveScoreboardDisplayTheme } from "@/lib/scoreboard-display-theme";
import { getPublishedCompetitionScoreboardBySlug } from "@/lib/scoreboards";

type StreamScoreboardBannerPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    brand?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: StreamScoreboardBannerPageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);
  const isTeeLounge = resolveScoreboardDisplayTheme(query.brand) === "tee-lounge";
  const title = competition
    ? `${competition.title} ${isTeeLounge ? "Tee Lounge Banner" : "Stream Scoreboard Banner"}`
    : isTeeLounge
      ? "Tee Lounge Banner"
      : "Stream Scoreboard Banner";

  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StreamScoreboardBannerPage({
  params,
  searchParams,
}: StreamScoreboardBannerPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);
  const theme = resolveScoreboardDisplayTheme(query.brand);

  if (!competition) {
    notFound();
  }

  return (
    <main className="stream-banner-page">
      <StreamScoreboardBanner initialCompetition={competition} theme={theme} />
    </main>
  );
}
