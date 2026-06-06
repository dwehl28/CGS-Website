import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StreamScoreboardOverlay from "@/components/scoreboard/StreamScoreboardOverlay";
import { getPublishedCompetitionScoreboardBySlug } from "@/lib/scoreboards";

type StreamScoreboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: StreamScoreboardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);
  const title = competition
    ? `${competition.title} Stream Scoreboard`
    : "Stream Scoreboard";

  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StreamScoreboardPage({
  params,
}: StreamScoreboardPageProps) {
  const { slug } = await params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);

  if (!competition) {
    notFound();
  }

  return (
    <main className="stream-overlay-page">
      <StreamScoreboardOverlay initialCompetition={competition} />
    </main>
  );
}
