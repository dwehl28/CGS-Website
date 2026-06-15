import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StreamScoreboardBanner from "@/components/scoreboard/StreamScoreboardBanner";
import { getPublishedCompetitionScoreboardBySlug } from "@/lib/scoreboards";

type StreamScoreboardBannerPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: StreamScoreboardBannerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);
  const title = competition
    ? `${competition.title} Stream Scoreboard Banner`
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
}: StreamScoreboardBannerPageProps) {
  const { slug } = await params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);

  if (!competition) {
    notFound();
  }

  return (
    <main className="stream-banner-page">
      <StreamScoreboardBanner initialCompetition={competition} />
    </main>
  );
}
