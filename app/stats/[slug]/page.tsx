import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import RoundStatsDashboard from "@/components/round-stats/RoundStatsDashboard";
import { buildMetadata } from "@/lib/seo";
import {
  getPublishedRoundStatRoundBySlug,
  getRoundStatsSnapshot,
} from "@/lib/round-stats";

type RoundStatsDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: RoundStatsDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const round = await getPublishedRoundStatRoundBySlug(slug);

  if (!round) {
    return buildMetadata({
      title: "Round Stats",
      description:
        "Explore CGS round stat tracking, team comparisons, and player contribution data.",
      path: `/stats/${slug}`,
    });
  }

  return buildMetadata({
    title: `${round.title} Stats`,
    description: round.summary,
    path: `/stats/${round.slug}`,
  });
}

export default async function RoundStatsDetailPage({
  params,
}: RoundStatsDetailPageProps) {
  const { slug } = await params;
  const round = await getPublishedRoundStatRoundBySlug(slug);

  if (!round) {
    notFound();
  }

  const snapshot = getRoundStatsSnapshot(round);

  return (
    <main className="min-h-screen text-white">
      <section className="page-shell">
        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/stats" className="btn-secondary">
            Back to stats
          </Link>
          <Link href="/scoreboard" className="btn-secondary">
            Scoreboard
          </Link>
          <Link href="/clubhouse-admin/round-stats" className="btn-secondary">
            Admin input
          </Link>
        </div>

        <RoundStatsDashboard snapshot={snapshot} />
      </section>
    </main>
  );
}
