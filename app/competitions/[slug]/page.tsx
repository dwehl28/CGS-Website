import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAmbroseSnapshot,
  getPublishedAmbroseEventBySlug,
} from "@/lib/ambrose-events";
import { buildMetadata } from "@/lib/seo";

type AmbroseCompetitionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(value * 100)}%`;
}

export async function generateMetadata({
  params,
}: AmbroseCompetitionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedAmbroseEventBySlug(slug);

  if (!event) {
    return buildMetadata({
      title: "CGS Ambrose Competition",
      description: "CGS team Ambrose competition leaderboard and live stats.",
      path: `/competitions/${slug}`,
    });
  }

  return buildMetadata({
    title: `${event.title} Leaderboard`,
    description: event.summary,
    path: `/competitions/${event.slug}`,
  });
}

export default async function AmbroseCompetitionPage({
  params,
}: AmbroseCompetitionPageProps) {
  const { slug } = await params;
  const event = await getPublishedAmbroseEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const snapshot = getAmbroseSnapshot(event);
  const leader = snapshot.leaderboard[0] ?? null;

  return (
    <main className="min-h-screen text-white">
      <section className="page-shell max-w-7xl">
        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/play" className="btn-secondary">
            Player app
          </Link>
          <Link
            href={`/stream/ambrose/${event.slug}/leaderboard`}
            className="btn-secondary"
          >
            OBS leaderboard
          </Link>
          <Link href="/scoreboard" className="btn-secondary">
            Scoreboard
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="panel rounded-[2rem] p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip text-zinc-100">{event.statusLabel}</span>
              <span className="chip text-zinc-100">
                {event.isLive ? "Live now" : "Published"}
              </span>
              <span className="chip text-zinc-100">{event.bayCount} GSPro bays</span>
            </div>
            <h1 className="mt-6 text-5xl md:text-6xl">{event.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300">
              {event.summary}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="stat-pill rounded-[1.35rem] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Course
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {event.courseName}
                </p>
              </div>
              <div className="stat-pill rounded-[1.35rem] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Teams
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {snapshot.totalTeams}
                </p>
              </div>
              <div className="stat-pill rounded-[1.35rem] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Players
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {snapshot.totalPlayers}
                </p>
              </div>
              <div className="stat-pill rounded-[1.35rem] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Complete
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {formatPercent(snapshot.completionRate)}
                </p>
              </div>
            </div>
          </section>

          <section className="panel rounded-[2rem] p-6 md:p-8">
            <div className="eyebrow">Current lead</div>
            {leader ? (
              <>
                <h2 className="mt-5 text-4xl">{leader.team.name}</h2>
                <p className="mt-3 text-lg text-[var(--tan)]">
                  {leader.team.bayLabel} | {leader.thruLabel}
                </p>
                <div className="mt-6 rounded-[1.5rem] border border-white/8 bg-black/14 px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Team score
                  </p>
                  <p className="mt-2 text-6xl font-semibold text-white">
                    {leader.scoreLabel}
                  </p>
                </div>
                {leader.contributionLeader ? (
                  <p className="mt-5 text-sm leading-7 text-zinc-400">
                    Top contribution:{" "}
                    <Link
                      href={`/players/${leader.contributionLeader.handle}`}
                      className="font-semibold text-[var(--sky)]"
                    >
                      {leader.contributionLeader.nickname ||
                        leader.contributionLeader.displayName}
                    </Link>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-5 text-sm leading-7 text-zinc-400">
                Waiting for the first team score.
              </p>
            )}
          </section>
        </div>

        <section className="panel mt-8 rounded-[2rem] p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-2">
            <div>
              <div className="eyebrow">Leaderboard</div>
              <h2 className="mt-4 text-3xl md:text-4xl">Ambrose teams</h2>
            </div>
            <p className="text-sm text-zinc-400">
              Team score is calculated from saved hole strokes against par.
            </p>
          </div>

          {snapshot.leaderboard.length > 0 ? (
            <div className="hidden overflow-hidden rounded-[1.5rem] border border-white/8 md:block">
              <table className="min-w-full border-collapse text-left">
                <thead className="bg-black/18 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-4">Pos</th>
                    <th className="px-4 py-4">Team</th>
                    <th className="px-4 py-4">Players</th>
                    <th className="px-4 py-4">Score</th>
                    <th className="px-4 py-4">Through</th>
                    <th className="px-4 py-4">GIR</th>
                    <th className="px-4 py-4">Putts</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.leaderboard.map((summary, index) => (
                    <tr
                      key={summary.team.id}
                      className="border-t border-white/8 bg-transparent"
                    >
                      <td className="px-4 py-4 text-lg font-semibold text-white">
                        {index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-white">
                          {summary.team.name}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {summary.team.bayLabel}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-300">
                        {summary.team.members.length > 0
                          ? summary.team.members.map((member) =>
                              member.profile ? (
                                <Link
                                  key={member.profileId}
                                  href={`/players/${member.profile.handle}`}
                                  className="mr-2 text-[var(--sky)]"
                                >
                                  {member.profile.nickname ||
                                    member.profile.displayName ||
                                    member.profile.handle}
                                </Link>
                              ) : null
                            )
                          : "--"}
                      </td>
                      <td className="px-4 py-4 text-lg text-[var(--tan)]">
                        {summary.scoreLabel}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {summary.thruLabel}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {formatPercent(summary.girRate)}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {summary.averagePutts === null
                          ? "--"
                          : summary.averagePutts.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-black/12 px-5 py-8 text-center">
              <p className="text-lg text-white">No team rows have been added yet.</p>
            </div>
          )}

          <div className="grid gap-4 md:hidden">
            {snapshot.leaderboard.map((summary, index) => (
              <div
                key={summary.team.id}
                className="rounded-[1.4rem] border border-white/8 bg-black/14 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Position {index + 1}
                    </p>
                    <h3 className="mt-2 text-2xl">{summary.team.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {summary.team.bayLabel} | {summary.thruLabel}
                    </p>
                  </div>
                  <span className="chip text-zinc-100">{summary.scoreLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {snapshot.playerContributions.length > 0 ? (
          <section className="panel mt-8 rounded-[2rem] p-6 md:p-8">
            <div className="eyebrow">Player contribution</div>
            <h2 className="mt-5 text-3xl">Shot usage</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.playerContributions.slice(0, 9).map((contribution) => (
                <Link
                  key={`${contribution.teamId}-${contribution.profileId}`}
                  href={`/players/${contribution.handle}`}
                  className="subtle-grid-card rounded-[1.35rem] px-4 py-4"
                >
                  <p className="font-semibold text-white">
                    {contribution.nickname || contribution.displayName}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {contribution.teamName}
                  </p>
                  <p className="mt-3 text-sm text-zinc-300">
                    {contribution.totalUses} uses | D {contribution.driveUses} |
                    A {contribution.approachUses} | P {contribution.puttUses}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
