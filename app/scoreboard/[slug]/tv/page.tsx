import type { Metadata } from "next";
import { notFound } from "next/navigation";

import SolosStablefordTv from "@/components/scoreboard/SolosStablefordTv";
import { getPublishedCompetitionScoreboardBySlug } from "@/lib/scoreboards";

type SolosStablefordTvPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: SolosStablefordTvPageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);

  return {
    title: competition
      ? `${competition.title} TV Leaderboard`
      : "Solos Stableford TV Leaderboard",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SolosStablefordTvPage({
  params,
}: SolosStablefordTvPageProps) {
  const { slug } = await params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);

  if (!competition) {
    notFound();
  }

  return (
    <main className="solos-tv-page">
      <SolosStablefordTv initialCompetition={competition} />
    </main>
  );
}
