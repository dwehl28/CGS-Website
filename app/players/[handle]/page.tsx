import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicPlayerProfileByHandle } from "@/lib/ambrose-events";
import { buildMetadata } from "@/lib/seo";

type PlayerProfilePageProps = {
  params: Promise<{
    handle: string;
  }>;
};

export const dynamic = "force-dynamic";

function formatNumber(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(digits);
}

export async function generateMetadata({
  params,
}: PlayerProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const playerProfile = await getPublicPlayerProfileByHandle(handle);

  if (!playerProfile) {
    return buildMetadata({
      title: "CGS Player",
      description: "CGS player profile and season stats.",
      path: `/players/${handle}`,
    });
  }

  const displayName =
    playerProfile.profile.nickname ||
    playerProfile.profile.displayName ||
    playerProfile.profile.handle;

  return buildMetadata({
    title: `${displayName} Player Profile`,
    description: `${displayName} CGS player profile, handicap, current team, and Ambrose season stats.`,
    path: `/players/${playerProfile.profile.handle}`,
  });
}

export default async function PlayerProfilePage({
  params,
}: PlayerProfilePageProps) {
  const { handle } = await params;
  const playerProfile = await getPublicPlayerProfileByHandle(handle);

  if (!playerProfile) {
    notFound();
  }

  const { profile, currentTeam, stats, memberships } = playerProfile;
  const displayName = profile.nickname || profile.displayName || profile.handle;
  const avatarUrl = profile.avatarUrl || "/cgs-logo.png";

  return (
    <main className="min-h-screen text-white">
      <section className="page-shell max-w-6xl">
        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/play" className="btn-secondary">
            Player app
          </Link>
          <Link href="/scoreboard" className="btn-secondary">
            Scoreboard
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.42fr_0.58fr]">
          <section className="panel rounded-[2rem] p-6 md:p-8">
            <div
              className="h-44 rounded-[1.5rem] border border-white/12 bg-white bg-cover bg-center"
              style={{ backgroundImage: `url("${avatarUrl}")` }}
              aria-label={`${displayName} profile photo`}
            />
            <div className="mt-6">
              <div className="eyebrow">CGS player</div>
              <h1 className="mt-5 text-5xl">{displayName}</h1>
              <p className="mt-3 text-lg text-zinc-300">@{profile.handle}</p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="stat-pill rounded-[1.25rem] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Handicap
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {profile.handicap === null ? "--" : profile.handicap}
                </p>
              </div>
              <div className="stat-pill rounded-[1.25rem] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Current team
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {currentTeam?.teamName ?? "Unassigned"}
                </p>
              </div>
            </div>

            {currentTeam ? (
              <div className="mt-6 rounded-[1.3rem] border border-white/8 bg-black/14 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Live assignment
                </p>
                <p className="mt-2 font-semibold text-white">
                  {currentTeam.eventTitle}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {currentTeam.bayLabel} | {currentTeam.teamShortName || currentTeam.teamName}
                </p>
              </div>
            ) : null}
          </section>

          <section className="grid gap-8">
            <div className="panel rounded-[2rem] p-6 md:p-8">
              <div className="eyebrow">Season stats</div>
              <h2 className="mt-5 text-4xl">Ambrose profile</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Season stats are built from team Ambrose score entries and shot
                contribution tracking.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Events
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {stats.eventsPlayed}
                  </p>
                </div>
                <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Holes tracked
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {stats.holesRecorded}
                  </p>
                </div>
                <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Team avg
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatNumber(stats.averageTeamScoreToPar)}
                  </p>
                </div>
                <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Contributions
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {stats.totalContributionUses}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.25rem] border border-white/8 bg-black/12 px-4 py-4">
                  <p className="text-sm text-zinc-400">Drives used</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {stats.driveUses}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/8 bg-black/12 px-4 py-4">
                  <p className="text-sm text-zinc-400">Approaches used</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {stats.approachUses}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/8 bg-black/12 px-4 py-4">
                  <p className="text-sm text-zinc-400">Putts used</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {stats.puttUses}
                  </p>
                </div>
              </div>
            </div>

            <div className="panel rounded-[2rem] p-6 md:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="eyebrow">Teams</div>
                  <h2 className="mt-5 text-3xl">Competition history</h2>
                </div>
                <span className="chip text-zinc-100">
                  {memberships.length} assignment
                  {memberships.length === 1 ? "" : "s"}
                </span>
              </div>

              {memberships.length > 0 ? (
                <div className="mt-6 space-y-4">
                  {memberships.map((membership) => (
                    <Link
                      key={`${membership.eventSlug}-${membership.teamName}`}
                      href={`/competitions/${membership.eventSlug}`}
                      className="subtle-grid-card block rounded-[1.35rem] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {membership.teamName}
                          </p>
                          <p className="mt-1 text-sm text-zinc-400">
                            {membership.eventTitle} | {membership.seasonLabel}
                          </p>
                        </div>
                        <span className="chip text-zinc-100">
                          {membership.isLive ? "Live" : membership.bayLabel}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-[1.35rem] border border-dashed border-white/12 bg-black/12 px-5 py-6 text-sm leading-7 text-zinc-400">
                  No published CGS team assignments yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
