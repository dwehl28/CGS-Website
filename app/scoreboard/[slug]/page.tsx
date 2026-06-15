import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LiveCompetitionBoard from "@/components/scoreboard/LiveCompetitionBoard";
import { buildMetadata } from "@/lib/seo";
import { getPublishedCompetitionScoreboardBySlug } from "@/lib/scoreboards";

type ScoreboardDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ScoreboardDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);

  if (!competition) {
    return buildMetadata({
      title: "Live Scoreboard",
      description:
        "Follow live CGS competition scoreboards, leaderboard movement, and final results as they are updated.",
      path: `/scoreboard/${slug}`,
    });
  }

  return buildMetadata({
    title: `${competition.title} Scoreboard`,
    description: competition.summary,
    path: `/scoreboard/${competition.slug}`,
  });
}

export default async function ScoreboardDetailPage({
  params,
}: ScoreboardDetailPageProps) {
  const { slug } = await params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);

  if (!competition) {
    notFound();
  }

  return (
    <main className="min-h-screen text-white">
      <section className="page-shell">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <Link href="/scoreboard" className="btn-secondary">
              Back to scoreboard
            </Link>
            <Link href={`/scoreboard/${competition.slug}/stream`} className="btn-primary">
              Stream overlay
            </Link>
            <Link href={`/scoreboard/${competition.slug}/banner`} className="btn-secondary">
              Banner ticker
            </Link>
            <Link href="/events" className="btn-secondary">
              View events
            </Link>
          </div>
        </div>

        <LiveCompetitionBoard initialCompetition={competition} />
      </section>
    </main>
  );
}
