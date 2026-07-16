import type { Metadata } from "next";
import Link from "next/link";

import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminShell, {
  AdminAccessState,
} from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import RoundStatEntryComposer from "@/components/round-stats/RoundStatEntryComposer";
import RoundStatsDashboard from "@/components/round-stats/RoundStatsDashboard";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { getAdminRoundStatRounds, getRoundStatsSnapshot } from "@/lib/round-stats";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Round Stats Admin",
    description:
      "Private CGS admin area for entering team, player, and hole stats during live rounds.",
    path: "/clubhouse-admin/round-stats",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function RoundStatsAdminPage() {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const isAuthenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Round stats admin is not ready yet"
        description="Add CGS_ADMIN_SECRET to the local and hosted environment so this internal route can be used safely."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="Round stats admin"
        description="This hidden page is for entering hole-by-hole Ambrose stats and turning them into public team and player displays."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const feed = await getAdminRoundStatRounds();
  const snapshots = feed.rounds.map(getRoundStatsSnapshot);
  const liveRounds = feed.rounds.filter((round) => round.isLive).length;
  const publishedRounds = feed.rounds.filter((round) => round.isPublished).length;
  const totalTeams = snapshots.reduce(
    (total, snapshot) => total + snapshot.totalTeams,
    0
  );
  const totalEntries = snapshots.reduce(
    (total, snapshot) => total + snapshot.completeEntries,
    0
  );

  return (
    <AdminShell
      eyebrow="Internal tools"
      title="Round stats admin"
      description="A prototype control desk for richer live coverage: enter hole results, fairways, greens, putts, penalties, and Ambrose player contributions."
      actions={
        <>
          <Link href="/clubhouse-admin" className="btn-secondary">
            Dashboard
          </Link>
          <Link href="/stats" className="btn-secondary">
            Public stats
          </Link>
          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </>
      }
    >
      {feed.warningMessage ? (
        <div className="rounded-[1.35rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-4 text-sm leading-7 text-zinc-200">
          {feed.warningMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Stat rounds"
          value={feed.rounds.length}
          detail="Rounds available in the stat tracking system."
        />
        <AdminMetricCard
          label="Live rounds"
          value={liveRounds}
          detail={`${publishedRounds} published round${publishedRounds === 1 ? "" : "s"} total.`}
        />
        <AdminMetricCard
          label="Teams tracked"
          value={totalTeams}
          detail="Teams with player lists ready for Ambrose contribution input."
        />
        <AdminMetricCard
          label="Entries saved"
          value={totalEntries}
          detail="Completed team-hole stat rows across all rounds."
        />
      </div>

      <div className="mt-10 space-y-10">
        {snapshots.map((snapshot) => (
          <section key={snapshot.round.id} className="panel rounded-[2rem] p-6 md:p-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="chip text-zinc-100">
                    {snapshot.round.statusLabel}
                  </span>
                  <span className="chip text-zinc-100">
                    {snapshot.round.isPublished ? "Published" : "Hidden"}
                  </span>
                  <span className="chip text-zinc-100">
                    {snapshot.round.isLive ? "Live now" : "Not live"}
                  </span>
                </div>
                <h2 className="mt-5 text-4xl">{snapshot.round.title}</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
                  {snapshot.round.summary}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/stats/${snapshot.round.slug}`}
                  className="btn-primary"
                >
                  Open public display
                </Link>
                <Link href="/scoreboard" className="btn-secondary">
                  Scoreboard
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-8 xl:grid-cols-[0.48fr_0.52fr]">
              <div className="round-stat-admin-input">
                <div>
                  <p className="round-stat-kicker">Live input</p>
                  <h3>Enter one team-hole result</h3>
                  <p>
                    Designed for stream nights: pick the team and hole, add the
                    score-to-par, then capture the Ambrose details that become
                    display stats.
                  </p>
                </div>

                {feed.source === "database" ? (
                  <RoundStatEntryComposer round={snapshot.round} />
                ) : (
                  <div className="round-stat-empty">
                    Apply the Supabase migration before entering live stat data.
                  </div>
                )}
              </div>

              <div className="round-stat-admin-preview">
                <RoundStatsDashboard snapshot={snapshot} showAdminHints />
              </div>
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
