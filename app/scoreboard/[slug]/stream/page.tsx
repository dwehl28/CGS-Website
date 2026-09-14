import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StreamScoreboardOverlay from "@/components/scoreboard/StreamScoreboardOverlay";
import { resolveScoreboardDisplayTheme } from "@/lib/scoreboard-display-theme";
import { getPublishedCompetitionScoreboardBySlug } from "@/lib/scoreboards";

type StreamScoreboardPageProps = {
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
}: StreamScoreboardPageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);
  const isTeeLounge = resolveScoreboardDisplayTheme(query.brand) === "tee-lounge";
  const title = competition
    ? `${competition.title} ${isTeeLounge ? "Tee Lounge Portrait" : "Stream Scoreboard"}`
    : isTeeLounge
      ? "Tee Lounge Portrait"
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
  searchParams,
}: StreamScoreboardPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);
  const theme = resolveScoreboardDisplayTheme(query.brand);

  if (!competition) {
    notFound();
  }

  return (
    <main className="stream-overlay-page">
      <StreamScoreboardOverlay initialCompetition={competition} theme={theme} />
    </main>
  );
}
