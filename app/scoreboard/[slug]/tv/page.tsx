import type { Metadata } from "next";
import { notFound } from "next/navigation";

import SolosStablefordTv from "@/components/scoreboard/SolosStablefordTv";
import { getPublishedCompetitionScoreboardBySlug } from "@/lib/scoreboards";

type SolosStablefordTvPageProps = {
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
}: SolosStablefordTvPageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);
  const isTeeLounge = query.brand === "tee-lounge";

  return {
    title: competition
      ? `${competition.title} ${isTeeLounge ? "Tee Lounge TV" : "TV Leaderboard"}`
      : isTeeLounge
        ? "Tee Lounge TV"
        : "Solos Stableford TV Leaderboard",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SolosStablefordTvPage({
  params,
  searchParams,
}: SolosStablefordTvPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);

  if (!competition) {
    notFound();
  }

  return (
    <main className="solos-tv-page">
      <SolosStablefordTv
        initialCompetition={competition}
        theme={query.brand === "tee-lounge" ? "tee-lounge" : "cgs"}
      />
    </main>
  );
}
