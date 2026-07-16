import type { Metadata } from "next";
import Link from "next/link";

import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
import {
  getPublishedRoundStatRounds,
  getRoundStatsSnapshot,
} from "@/lib/round-stats";

export const metadata: Metadata = buildMetadata({
  title: "Round Stats",
  description:
    "Explore CGS round stat tracking, team comparisons, and player contribution data.",
  path: "/stats",
});

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const feed = await getPublishedRoundStatRounds();

  return (
    <main className="min-h-screen text-white">
      <section className="page-shell">
        <PageIntro
          eyebrow="Stats lab"
          title="CGS Round Stats"
          description="A prototype home for richer live round data: team score context, Ambrose contribution tracking, fairways, greens, putting, penalties, and hole-by-hole movement."
          align="center"
          actions={[
            { href: "/scoreboard", label: "Live scoreboard" },
            {
              href: "/clubhouse-admin/round-stats",
              label: "Admin input",
              variant: "secondary",
            },
          ]}
        />

        {feed.warningMessage ? (
          <div className="mx-auto max-w-3xl rounded-[1.4rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-4 text-sm leading-7 text-zinc-200">
            {feed.warningMessage}
          </div>
        ) : null}

        {feed.rounds.length > 0 ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {feed.rounds.map((round) => {
              const snapshot = getRoundStatsSnapshot(round);
              const leader = snapshot.leaderboard[0] ?? null;

              return (
                <article key={round.id} className="panel rounded-[2rem] p-6 md:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="chip text-zinc-100">{round.statusLabel}</span>
                    <span className="chip text-zinc-100">
                      {round.isLive ? "Live tracking" : "Stats ready"}
                    </span>
                  </div>

                  <h2 className="mt-5 text-4xl">{round.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-300">
                    {round.summary}
                  </p>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Leader
                      </p>
                      <p className="mt-2 text-white">
                        {leader?.team.name ?? "Waiting"}
                      </p>
                    </div>
                    <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Score
                      </p>
                      <p className="mt-2 text-white">{leader?.scoreLabel ?? "--"}</p>
                    </div>
                    <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Completion
                      </p>
                      <p className="mt-2 text-white">
                        {snapshot.completeEntries}/{snapshot.totalEntriesPossible}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-4">
                    <Link href={`/stats/${round.slug}`} className="btn-primary">
                      Open stat display
                    </Link>
                    <Link
                      href="/clubhouse-admin/round-stats"
                      className="btn-secondary"
                    >
                      Enter stats
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto mt-12 max-w-3xl panel rounded-[2rem] p-8 text-center md:p-10">
            <h2 className="text-4xl">No stat rounds are public yet</h2>
            <p className="mt-5 text-base leading-8 text-zinc-300">
              Once a round is published from the admin side, richer team and player
              stat displays will appear here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
