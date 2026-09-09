import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  ExternalLink,
  MonitorPlay,
  Radio,
  Trophy,
  Users,
} from "lucide-react";

import {
  createPar3PlayerAction,
  generatePar3KnockoutAction,
  generatePar3PoolFixturesAction,
  recordPar3KnockoutWinnerAction,
  resetPar3KnockoutMatchAction,
  updatePar3EventAction,
  updatePar3CtpWinnerAction,
  updatePar3PlayerAction,
  updatePar3PoolMatchAction,
} from "@/app/clubhouse-admin/par3/actions";
import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import AdminShell, { AdminAccessState } from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { getAdminPar3Snapshot } from "@/lib/par3-showdown";
import {
  PAR3_MATCH_COMPLETED,
  PAR3_ROUND_OF_16_TEMPLATE,
  buildPar3Pools,
  getPar3CtpContestants,
  getPar3CtpWinner,
  getKnockoutParticipantName,
  getPar3Champion,
  getPar3KnockoutRounds,
  getPoolStage,
  getTeeCategoryLabel,
  resolvePar3BracketSlot,
  type AdminPar3Player,
  type Par3PoolMatch,
} from "@/lib/par3-showdown-types";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Par 3 Tournament Control",
    description: "Private control room for the 2026 CGS Par 3 Championship.",
    path: "/clubhouse-admin/par3",
  }),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ notice?: string }>;
};

const noticeMessages: Record<string, string> = {
  "settings-saved": "Public event status updated.",
  "settings-failed": "Event settings could not be saved.",
  "player-check": "Enter a name and phone number, and confirm consent.",
  "player-added": "Entrant added.",
  "player-saved": "Entrant details updated.",
  "player-failed": "Entrant details could not be saved.",
  "fixtures-created": "Pool fixtures generated.",
  "fixtures-failed":
    "Fixtures could not be generated. Check pool allocations, or existing results.",
  "result-saved": "Pool result updated.",
  "result-failed": "Pool result could not be saved.",
  "ctp-saved": "CTP winner confirmed for the Round of 16.",
  "ctp-reset": "CTP winner cleared.",
  "ctp-failed": "CTP winner could not be updated. Confirm the pool tables first.",
  "knockout-created": "Round of 16 created from the confirmed qualifiers.",
  "knockout-failed":
    "Finals could not be created. Complete all five pools and confirm the CTP winner.",
  "final-result-saved": "Finals result updated.",
  "final-result-failed": "Finals result could not be saved.",
  "final-reset": "Finals result reset.",
  "final-reset-failed":
    "That result cannot be reset after a later match has been completed.",
};

function TeeOptions() {
  return (
    <>
      <option value="championship">
        Championship tees
      </option>
      <option value="ladies">
        Ladies - red tees
      </option>
      <option value="junior">
        Junior - front tees
      </option>
    </>
  );
}

function PoolOptions() {
  return (
    <>
      <option value="">Not allocated</option>
      {Array.from({ length: 5 }, (_, index) => index + 1).map((number) => (
        <option key={number} value={number}>
          Pool {String.fromCharCode(64 + number)}
        </option>
      ))}
    </>
  );
}

function PlayerEditor({
  player,
  eventId,
}: {
  player: AdminPar3Player;
  eventId: number;
}) {
  return (
    <details
      id={`player-${player.id}`}
      className="simple-details border-t border-white/10 py-4 first:border-t-0"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <strong className="text-white">{player.name}</strong>
          <span className="ml-3 text-sm text-zinc-400">
            {player.poolNumber
              ? `Pool ${String.fromCharCode(64 + player.poolNumber)}`
              : "Unallocated"}
          </span>
        </span>
        <span className="text-xs text-zinc-500">
          {getTeeCategoryLabel(player.teeCategory)}
        </span>
      </summary>

      <form
        action={updatePar3PlayerAction}
        className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="player_id" value={player.id} />
        <div>
          <label className="field-label" htmlFor={`name-${player.id}`}>
            Player name
          </label>
          <input
            id={`name-${player.id}`}
            name="name"
            className="field-control"
            defaultValue={player.name}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`phone-${player.id}`}>
            Phone
          </label>
          <input
            id={`phone-${player.id}`}
            name="phone"
            className="field-control"
            defaultValue={player.phone}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`tee-${player.id}`}>
            Tee category
          </label>
          <select
            id={`tee-${player.id}`}
            name="tee_category"
            className="field-control"
            defaultValue={player.teeCategory}
          >
            <TeeOptions />
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`pool-${player.id}`}>
            Pool
          </label>
          <select
            id={`pool-${player.id}`}
            name="pool_number"
            className="field-control"
            defaultValue={player.poolNumber ?? ""}
          >
            <PoolOptions />
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`order-${player.id}`}>
            Display order
          </label>
          <input
            id={`order-${player.id}`}
            name="display_order"
            type="number"
            min="1"
            max="99"
            className="field-control"
            defaultValue={player.displayOrder}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`rank-${player.id}`}>
            Manual pool seed
          </label>
          <select
            id={`rank-${player.id}`}
            name="pool_rank_override"
            className="field-control"
            defaultValue={player.poolRankOverride ?? ""}
          >
            <option value="">Use results</option>
            {[1, 2, 3, 4].map((rank) => (
              <option key={rank} value={rank}>
                Seed {rank}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-3 text-sm text-zinc-200">
          <input type="checkbox" name="consent" defaultChecked={player.consent} />
          Consent confirmed
        </label>
        <label className="flex items-center gap-3 text-sm text-zinc-200">
          <input
            type="checkbox"
            name="is_withdrawn"
            defaultChecked={player.isWithdrawn}
          />
          Withdrawn
        </label>
        <button type="submit" className="btn-primary md:col-span-2 xl:col-span-4">
          Save player
        </button>
      </form>
    </details>
  );
}

function PoolMatchControl({
  match,
  playersById,
}: {
  match: Par3PoolMatch;
  playersById: Map<number, AdminPar3Player>;
}) {
  const first = playersById.get(match.player1Id);
  const second = playersById.get(match.player2Id);
  const winner = match.winnerId ? playersById.get(match.winnerId) : null;
  const stage = getPoolStage(match.matchNumber);

  if (!first || !second) {
    return null;
  }

  return (
    <div id={`match-${match.id}`} className="border-t border-white/10 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>{stage?.label ?? `Match ${match.matchNumber}`} / Match {match.matchNumber}</span>
        <span>{match.bayNumber ? `Bay ${match.bayNumber}` : "Bay not set"}</span>
      </div>

      {winner ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-white">
            <Check className="mr-2 inline size-4 text-emerald-300" />
            {winner.name} won
          </p>
          <form action={updatePar3PoolMatchAction}>
            <input type="hidden" name="match_id" value={match.id} />
            <button type="submit" className="btn-secondary">
              Undo
            </button>
          </form>
        </div>
      ) : (
        <form action={updatePar3PoolMatchAction} className="mt-3">
          <label className="sr-only" htmlFor={`bay-${match.id}`}>
            Bay
          </label>
          <select
            id={`bay-${match.id}`}
            name="bay_number"
            className="field-control mb-2"
            defaultValue={match.bayNumber ?? ""}
          >
            <option value="">Bay not set</option>
            <option value="1">Bay 1</option>
            <option value="2">Bay 2</option>
            <option value="3">Bay 3</option>
          </select>
          <input type="hidden" name="match_id" value={match.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="submit"
              name="winner_id"
              value={first.id}
              className="min-h-14 border border-white/15 bg-white/5 px-4 py-3 text-left font-semibold text-white hover:border-cyan-300 hover:bg-cyan-300/10"
            >
              {first.name}
            </button>
            <button
              type="submit"
              name="winner_id"
              value={second.id}
              className="min-h-14 border border-white/15 bg-white/5 px-4 py-3 text-left font-semibold text-white hover:border-cyan-300 hover:bg-cyan-300/10"
            >
              {second.name}
            </button>
          </div>
          <button
            type="submit"
            className="mt-2 w-full px-3 py-2 text-xs font-semibold uppercase text-cyan-200 hover:bg-white/5"
          >
            Set selected bay / mark live
          </button>
        </form>
      )}
    </div>
  );
}

export default async function Par3AdminPage({ searchParams }: PageProps) {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const authenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Par 3 control is not ready"
        description="Configure the CGS admin session before using this route."
      />
    );
  }

  if (!authenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="Par 3 tournament control"
        description="Sign in to manage entrants, pool results, and the finals bracket."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const { notice } = await searchParams;
  let snapshot;

  try {
    snapshot = await getAdminPar3Snapshot();
  } catch (error) {
    console.error("Load Par 3 admin error:", error);
    return (
      <AdminShell
        eyebrow="Event control"
        title="Par 3 Championship"
        description="The tournament database is not available yet. Apply the latest migration, then reload this page."
      >
        <div className="panel p-6 text-zinc-300">
          Tournament storage has not been created yet.
        </div>
      </AdminShell>
    );
  }

  const { event, players, poolMatches } = snapshot;
  const pools = buildPar3Pools(snapshot);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const activePlayers = players.filter((player) => !player.isWithdrawn);
  const completedPoolMatches = poolMatches.filter(
    (match) => match.winnerId !== null
  ).length;
  const ctpContestants = getPar3CtpContestants(snapshot);
  const ctpWinner = getPar3CtpWinner(snapshot);
  const poolStandingsLocked = pools.every(
    (pool) =>
      pool.matches.filter((match) => match.winnerId !== null).length === 6 ||
      pool.standings.every(
        (standing) => standing.player.poolRankOverride !== null
      )
  );
  const finalsReady = poolStandingsLocked && Boolean(ctpWinner);
  const knockoutRounds = getPar3KnockoutRounds(event.knockoutData);
  const champion = getPar3Champion(event.knockoutData);

  return (
    <AdminShell
      eyebrow="Event control"
      title="Par 3 Championship"
      description="Work from left to right: entrants, pool play, then finals. Public results update as soon as you save them."
      actions={
        <>
          <Link href="/" target="_blank" className="btn-secondary">
            Public hub <ExternalLink className="ml-2 inline size-4" />
          </Link>
          <Link
            href="/stream/par3-showdown?view=banner"
            target="_blank"
            className="btn-secondary"
          >
            OBS banner <ExternalLink className="ml-2 inline size-4" />
          </Link>
          <Link
            href="/stream/par3-showdown?view=tv"
            target="_blank"
            className="btn-secondary"
          >
            TV rotation <ExternalLink className="ml-2 inline size-4" />
          </Link>
          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </>
      }
    >
      {notice && noticeMessages[notice] ? (
        <div className="mb-6 border border-cyan-300/25 bg-cyan-300/8 px-5 py-4 text-sm text-cyan-50">
          {noticeMessages[notice]}
        </div>
      ) : null}

      <nav className="mb-8 grid gap-2 sm:grid-cols-4">
        {[
          ["entrants", "1. Entrants"],
          ["pool-play", "2. Pool play"],
          ["ctp-playoff", "3. CTP playoff"],
          ["finals", "4. Finals"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={`#${href}`}
            className="flex min-h-12 items-center justify-between border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white hover:border-cyan-300/50"
          >
            {label}
            <ChevronRight className="size-4 text-cyan-300" />
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Entrants", `${activePlayers.length} / ${event.maxPlayers}`, Users],
          ["Pool results", `${completedPoolMatches} / ${poolMatches.length}`, Check],
          ["Phase", event.currentPhase, Radio],
          ["Champion", champion ?? "TBD", Trophy],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="border border-white/10 bg-white/4 p-5">
            <Icon className="size-5 text-cyan-300" />
            <p className="mt-5 text-xs font-semibold uppercase text-zinc-500">
              {String(label)}
            </p>
            <p className="mt-1 text-xl font-bold capitalize text-white">
              {String(value)}
            </p>
          </div>
        ))}
      </section>

      <section className="panel mt-8 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Broadcast package</p>
            <h2 className="mt-3 text-2xl">OBS and TV assets</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            Add any URL below as an OBS browser source. Every view reads the same live tournament data.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["banner", "Lower-third banner", "1920 x 180"],
            ["portrait", "Sidebar rotation", "407 x 1359"],
            ["fixtures", "Fixture draw", "1920 x 1080"],
            ["results", "Latest results", "1920 x 1080"],
            ["standings", "Pool tables", "1920 x 1080"],
            ["bracket", "Finals bracket", "1920 x 1080"],
            ["road", "Eight stages", "1920 x 1080"],
            ["tv", "Automatic TV rotation", "1920 x 1080"],
          ].map(([view, label, size]) => (
            <Link
              key={view}
              href={`/stream/par3-showdown?view=${view}`}
              target="_blank"
              className="flex min-h-20 items-center justify-between gap-3 border border-white/10 bg-white/5 p-4 hover:border-cyan-300/55 hover:bg-cyan-300/8"
            >
              <span>
                <strong className="block text-sm text-white">{label}</strong>
                <small className="mt-1 block text-xs uppercase tracking-wider text-zinc-500">{size}</small>
              </span>
              <MonitorPlay className="size-5 text-cyan-300" />
            </Link>
          ))}
        </div>
      </section>

      <details className="simple-details panel mt-8 p-6">
        <summary>Public event status</summary>
        <form action={updatePar3EventAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="event_id" value={event.id} />
          <div>
            <label className="field-label" htmlFor="status-label">
              Public status
            </label>
            <input
              id="status-label"
              name="status_label"
              className="field-control"
              defaultValue={event.statusLabel}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="current-phase">
              Current phase
            </label>
            <select
              id="current-phase"
              name="current_phase"
              className="field-control"
              defaultValue={event.currentPhase}
            >
              <option value="registrations">Registrations</option>
              <option value="pools">Pool play</option>
              <option value="knockout">Finals</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="field-label" htmlFor="public-message">
              Public message
            </label>
            <input
              id="public-message"
              name="public_message"
              className="field-control"
              defaultValue={event.publicMessage}
            />
          </div>
          <div className="md:col-span-2">
            <label className="field-label" htmlFor="youtube-url">
              YouTube channel or live video URL
            </label>
            <input
              id="youtube-url"
              name="youtube_url"
              type="url"
              className="field-control"
              defaultValue={event.youtubeUrl}
            />
          </div>
          <label className="flex items-center gap-3 text-sm text-zinc-200">
            <input
              type="checkbox"
              name="registrations_open"
              defaultChecked={event.registrationsOpen}
            />
            Registrations open
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-200">
            <input type="checkbox" name="is_live" defaultChecked={event.isLive} />
            Show event as live
          </label>
          <button type="submit" className="btn-primary md:col-span-2">
            Update public hub
          </button>
        </form>
      </details>

      <section id="entrants" className="scroll-mt-24 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 className="mt-3 text-3xl">Entrants and pools</h2>
          </div>
          <p className="text-sm text-zinc-400">
            Phone numbers stay private in admin.
          </p>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <form action={createPar3PlayerAction} className="panel grid content-start gap-4 p-6">
            <input type="hidden" name="event_id" value={event.id} />
            <input
              type="hidden"
              name="display_order"
              value={activePlayers.length + 1}
            />
            <h3 className="text-xl">Add entrant</h3>
            <div>
              <label className="field-label" htmlFor="new-player-name">
                Name
              </label>
              <input
                id="new-player-name"
                name="name"
                className="field-control"
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-player-phone">
                Phone
              </label>
              <input
                id="new-player-phone"
                name="phone"
                type="tel"
                className="field-control"
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-player-tee">
                Tee category
              </label>
              <select
                id="new-player-tee"
                name="tee_category"
                className="field-control"
                defaultValue="championship"
              >
                <TeeOptions />
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="new-player-pool">
                Pool
              </label>
              <select
                id="new-player-pool"
                name="pool_number"
                className="field-control"
                defaultValue=""
              >
                <PoolOptions />
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm text-zinc-200">
              <input type="checkbox" name="consent" required />
              Registration consent confirmed
            </label>
            <button type="submit" className="btn-primary">
              Add entrant
            </button>
          </form>

          <div className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl">Player list</h3>
              <span className="text-sm text-zinc-400">Tap a name to edit</span>
            </div>
            <div className="mt-4">
              {players.length ? (
                players.map((player) => (
                  <PlayerEditor key={player.id} player={player} eventId={event.id} />
                ))
              ) : (
                <p className="border border-dashed border-white/15 p-5 text-sm text-zinc-400">
                  No entrants yet. Add paid registrations here as they arrive.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="pool-play" className="scroll-mt-24 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Step 2</p>
            <h2 className="mt-3 text-3xl">Pool play</h2>
          </div>
          <form action={generatePar3PoolFixturesAction}>
            <input type="hidden" name="event_id" value={event.id} />
            <button type="submit" className="btn-primary">
              {poolMatches.length ? "Rebuild fixtures" : "Generate fixtures"}
            </button>
          </form>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          Allocate four players to each pool first. Tap a winner once a match is
          complete; standings and head-to-head tie-breaks update automatically.
        </p>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {pools.map((pool) => (
            <details
              key={pool.number}
              className="simple-details panel p-6"
              open={pool.matches.some((match) => match.status === "live")}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4">
                <span className="text-xl font-bold text-white">{pool.label}</span>
                <span className="text-sm text-zinc-400">
                  {pool.players.length} players / {pool.matches.length} matches
                </span>
              </summary>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="pb-3">Seed</th>
                      <th className="pb-3">Player</th>
                      <th className="pb-3 text-center">P</th>
                      <th className="pb-3 text-center">W</th>
                      <th className="pb-3 text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.standings.map((standing) => (
                      <tr key={standing.player.id} className="border-t border-white/10">
                        <td className="py-3 font-bold text-cyan-300">
                          {standing.position}
                        </td>
                        <td className="py-3 font-semibold text-white">
                          {standing.player.name}
                          {standing.tieBreakLabel ? (
                            <span className="ml-2 text-xs font-normal text-zinc-500">
                              {standing.tieBreakLabel}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 text-center text-zinc-300">
                          {standing.played}
                        </td>
                        <td className="py-3 text-center text-zinc-300">
                          {standing.wins}
                        </td>
                        <td className="py-3 text-center font-bold text-white">
                          {standing.wins}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 border-t border-white/10 pt-2">
                {pool.matches.length ? (
                  pool.matches.map((match) => (
                    <PoolMatchControl
                      key={match.id}
                      match={match}
                      playersById={playersById}
                    />
                  ))
                ) : (
                  <p className="py-4 text-sm text-zinc-400">
                    Fixtures have not been generated.
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section id="ctp-playoff" className="scroll-mt-24 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2 className="mt-3 text-3xl">Closest-to-pin playoff</h2>
          </div>
          <span className="border border-amber-300/25 bg-amber-300/8 px-4 py-2 text-sm font-semibold text-amber-200">
            Pebble Beach / 7th hole
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          The fourth-place player from each pool enters the CTP contest. Select the winner here to unlock the final Round-of-16 place against Pool A&apos;s winner.
        </p>

        <div className="panel mt-6 p-6">
          {poolStandingsLocked && ctpContestants.length === event.poolCount ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {ctpContestants.map((standing) => {
                const selected = ctpWinner?.id === standing.player.id;

                return (
                  <form key={standing.player.id} action={updatePar3CtpWinnerAction}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <button
                      type="submit"
                      name="player_id"
                      value={standing.player.id}
                      className={`min-h-24 w-full border p-4 text-left transition ${
                        selected
                          ? "border-amber-300 bg-amber-300/14"
                          : "border-white/10 bg-white/5 hover:border-cyan-300/55"
                      }`}
                    >
                      <span className="block text-xs font-bold uppercase tracking-wider text-cyan-300">
                        Pool {String.fromCharCode(64 + (standing.player.poolNumber ?? 1))} fourth
                      </span>
                      <strong className="mt-2 block text-lg text-white">
                        {standing.player.name}
                      </strong>
                      <small className="mt-1 block text-xs text-zinc-500">
                        {selected ? "CTP winner selected" : "Select as CTP winner"}
                      </small>
                    </button>
                  </form>
                );
              })}
            </div>
          ) : (
            <p className="border border-dashed border-white/15 p-5 text-sm text-zinc-400">
              Complete or manually seed all five pool tables to confirm the CTP field.
            </p>
          )}

          {ctpWinner ? (
            <form action={updatePar3CtpWinnerAction} className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <input type="hidden" name="event_id" value={event.id} />
              <p className="text-sm text-zinc-300">
                Current CTP winner: <strong className="text-amber-300">{ctpWinner.name}</strong>
              </p>
              <button type="submit" className="btn-secondary">Clear winner</button>
            </form>
          ) : null}
        </div>
      </section>

      <section id="finals" className="scroll-mt-24 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Step 4</p>
            <h2 className="mt-3 text-3xl">Finals bracket</h2>
          </div>
          {!event.knockoutData ? (
            <form action={generatePar3KnockoutAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" className="btn-primary" disabled={!finalsReady}>
                Generate Round of 16
              </button>
            </form>
          ) : null}
        </div>

        {champion ? (
          <div className="mt-6 border border-amber-300/30 bg-amber-300/8 p-6">
            <p className="text-xs font-bold uppercase text-amber-300">Champion</p>
            <p className="mt-2 text-3xl font-bold text-white">{champion}</p>
          </div>
        ) : null}

        {knockoutRounds.length ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {knockoutRounds.map((round) => (
              <div key={String(round.id)} className="panel p-6">
                <h3 className="text-xl">{round.label}</h3>
                <div className="mt-4">
                  {round.matches.map((match) => {
                    const firstName = getKnockoutParticipantName(
                      event.knockoutData!,
                      match.opponent1?.id
                    );
                    const secondName = getKnockoutParticipantName(
                      event.knockoutData!,
                      match.opponent2?.id
                    );
                    const completed = match.status === PAR3_MATCH_COMPLETED;
                    const winnerName =
                      match.opponent1?.result === "win"
                        ? firstName
                        : match.opponent2?.result === "win"
                          ? secondName
                          : null;
                    const actionable =
                      !completed &&
                      match.opponent1?.id !== null &&
                      match.opponent1?.id !== undefined &&
                      match.opponent2?.id !== null &&
                      match.opponent2?.id !== undefined;

                    return (
                      <div
                        key={String(match.id)}
                        className="border-t border-white/10 py-4 first:border-t-0 first:pt-0"
                      >
                        <p className="text-xs uppercase text-zinc-500">
                          Match {match.number}
                        </p>
                        {winnerName ? (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <p className="font-semibold text-white">
                              <Check className="mr-2 inline size-4 text-emerald-300" />
                              {winnerName} won
                            </p>
                            <form action={resetPar3KnockoutMatchAction}>
                              <input type="hidden" name="event_id" value={event.id} />
                              <input type="hidden" name="match_id" value={String(match.id)} />
                              <button type="submit" className="btn-secondary">
                                Undo
                              </button>
                            </form>
                          </div>
                        ) : actionable ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {[firstName, secondName].map((name, index) => (
                              <form
                                key={`${String(match.id)}-${index}`}
                                action={recordPar3KnockoutWinnerAction}
                              >
                                <input type="hidden" name="event_id" value={event.id} />
                                <input type="hidden" name="match_id" value={String(match.id)} />
                                <input type="hidden" name="winner_side" value={index + 1} />
                                <button
                                  type="submit"
                                  className="min-h-14 w-full border border-white/15 bg-white/5 px-4 py-3 text-left font-semibold text-white hover:border-cyan-300 hover:bg-cyan-300/10"
                                >
                                  {name}
                                </button>
                              </form>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-zinc-500">
                            {firstName} vs {secondName}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel mt-6 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Locked draw design</p>
                <h3 className="mt-2 text-xl">Round of 16 preview</h3>
              </div>
              <span className={`text-sm font-semibold ${finalsReady ? "text-emerald-300" : "text-zinc-500"}`}>
                {finalsReady ? "Ready to generate" : "Waiting for pool results + CTP"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {PAR3_ROUND_OF_16_TEMPLATE.map((pairing) => {
                const first = resolvePar3BracketSlot(snapshot, pairing.first);
                const second = resolvePar3BracketSlot(snapshot, pairing.second);

                return (
                  <div key={pairing.matchNumber} className="border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-bold uppercase text-zinc-500">
                      Lane {pairing.lane} / Match {pairing.matchNumber}
                    </p>
                    <p className="mt-3 font-semibold text-white">
                      {poolStandingsLocked && first ? first.name : pairing.first.label}
                    </p>
                    <span className="my-1 block text-xs uppercase text-amber-300">vs</span>
                    <p className="font-semibold text-white">
                      {(pairing.second.isCtp ? ctpWinner : poolStandingsLocked && second)
                        ? second?.name
                        : pairing.second.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-400">
              Lane 1 deliberately places Pool A&apos;s winner against the CTP qualifier, with Pool B&apos;s winner potentially waiting in the quarterfinal. The other first-place lanes feed toward second-place qualifiers.
            </p>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
